import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decrypt_token
from app.models.user import User
from app.models.wifi_sensor import SensorReading, RiskHistory
from app.services.risk_calculator import calculate_mental_health_risk

logger = logging.getLogger("google_fit_sync")

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_FIT_AGGREGATE_URL = "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate"

async def _refresh_google_access_token(encrypted_refresh_token: str) -> Dict[str, Any]:
    """
    Refreshes the Google OAuth access_token using stored encrypted refresh_token.
    Returns dictionary with {"success": bool, "access_token": str|None, "expired": bool, "error_msg": str|None}.
    """
    refresh_token = decrypt_token(encrypted_refresh_token)
    if not refresh_token:
        return {"success": False, "access_token": None, "expired": True, "error_msg": "Invalid/corrupt stored refresh token"}

    payload = {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(GOOGLE_TOKEN_URL, data=payload)

        if res.status_code == 200:
            token_data = res.json()
            return {"success": True, "access_token": token_data.get("access_token"), "expired": False, "error_msg": None}
        elif res.status_code == 400:
            err_json = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
            err_code = err_json.get("error", "")
            if err_code in ("invalid_grant", "unauthorized_client"):
                return {"success": False, "access_token": None, "expired": True, "error_msg": f"Token revoked or expired ({err_code})"}
            return {"success": False, "access_token": None, "expired": False, "error_msg": f"HTTP 400: {res.text}"}
        else:
            return {"success": False, "access_token": None, "expired": False, "error_msg": f"HTTP {res.status_code}: {res.text}"}
    except httpx.TimeoutException:
        raise
    except Exception as e:
        return {"success": False, "access_token": None, "expired": False, "error_msg": str(e)}


async def get_google_fit_data(user_id: int, db: Session) -> Dict[str, Any]:
    """
    Fetches Google Fit sensor data for the given user, handling ALL 5 failure modes explicitly:
    1. SUCCESS: parse steps, sleep, heart rate -> insert sensor_readings with data_source="google_fit"
    2. EMPTY RESPONSE: API call succeeds but 0 metrics found -> flag as no_data_available
    3. EXPIRED/REVOKED REFRESH TOKEN: invalid_grant -> clear connection timestamp, surface reconnect prompt
    4. RATE LIMIT / API ERROR: 429/500 errors -> retry once with backoff, then give up gracefully
    5. NETWORK TIMEOUT: 10s explicit timeout -> log and fail gracefully without hanging scheduled job
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        outcome = {"status": "error", "message": f"User ID {user_id} not found", "data": None}
        logger.error(f"[GOOGLE FIT SYNC - USER NOT FOUND] User ID {user_id} does not exist.")
        return outcome

    if not user.google_fit_refresh_token:
        outcome = {"status": "not_connected", "message": "Google Fit not connected for this user", "data": None}
        logger.info(f"[GOOGLE FIT SYNC - NOT CONNECTED] User {user.id} ({user.email}) has no refresh token.")
        return outcome

    # Step 1: Refresh Access Token
    try:
        token_res = await _refresh_google_access_token(user.google_fit_refresh_token)
    except httpx.TimeoutException:
        # OUTCOME 5: NETWORK TIMEOUT during token refresh
        outcome = {"status": "network_timeout", "message": "Network request timed out during token refresh (10s limit)", "data": None}
        logger.error(f"[GOOGLE FIT SYNC - OUTCOME 5: NETWORK TIMEOUT] Token refresh timed out for user_id={user.id}.")
        return outcome

    if not token_res["success"]:
        if token_res["expired"]:
            # OUTCOME 3: EXPIRED / REVOKED REFRESH TOKEN
            user.google_fit_connected_at = None
            db.commit()
            outcome = {"status": "expired_token", "message": "Google Fit authorization expired or revoked. Please reconnect.", "data": None}
            logger.warning(f"[GOOGLE FIT SYNC - OUTCOME 3: EXPIRED/REVOKED TOKEN] Invalid grant for user_id={user.id}: {token_res['error_msg']}")
            return outcome
        else:
            # OUTCOME 4: API Error during token refresh
            outcome = {"status": "api_error", "message": f"Token refresh failed: {token_res['error_msg']}", "data": None}
            logger.error(f"[GOOGLE FIT SYNC - OUTCOME 4: API ERROR] Token refresh error for user_id={user.id}: {token_res['error_msg']}")
            return outcome

    access_token = token_res["access_token"]
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Time window: Local midnight today (IST / User local timezone)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now_dt = datetime.now(timezone.utc)
    now_local = now_dt.astimezone(ist_tz)
    midnight_local = datetime(now_local.year, now_local.month, now_local.day, 0, 0, 0, tzinfo=ist_tz)

    now_ms = int(now_dt.timestamp() * 1000)
    start_ms = int(midnight_local.timestamp() * 1000)
    duration_ms = max(1, now_ms - start_ms)

    query_payload = {
        "aggregateBy": [
            {"dataTypeName": "com.google.step_count.delta"},
            {"dataTypeName": "com.google.heart_rate.bpm"},
            {"dataTypeName": "com.google.sleep.segment"}
        ],
        "bucketByTime": {"durationMillis": duration_ms},
        "startTimeMillis": start_ms,
        "endTimeMillis": now_ms
    }

    # Step 2: Call Google Fit Aggregate API with retry once for rate limit / 5xx
    response = None
    for attempt in range(1, 3):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(GOOGLE_FIT_AGGREGATE_URL, headers=headers, json=query_payload)

            if response.status_code == 200:
                break
            elif response.status_code in (429, 500, 502, 503, 504) and attempt == 1:
                logger.warning(f"[GOOGLE FIT SYNC - RETRY] Received HTTP {response.status_code} for user_id={user.id}. Retrying after 1s...")
                await asyncio.sleep(1.0)
                continue
            else:
                break
        except httpx.TimeoutException:
            # OUTCOME 5: NETWORK TIMEOUT during API call
            outcome = {"status": "network_timeout", "message": "Network request to Google Fit API timed out (10s limit)", "data": None}
            logger.error(f"[GOOGLE FIT SYNC - OUTCOME 5: NETWORK TIMEOUT] Aggregate query timed out for user_id={user.id}.")
            return outcome

    if not response or response.status_code != 200:
        # OUTCOME 4: RATE LIMIT / API ERROR
        status_code = response.status_code if response else "Unknown"
        err_body = response.text if response else "No response"
        logger.error(f"[GOOGLE FIT SYNC - OUTCOME 4: API ERROR] HTTP {status_code} for user_id={user.id}: {err_body[:200]}")
        return {"status": "api_error", "message": f"Google Fit API HTTP {status_code} error", "data": None}

    raw_json_data = response.json()

    # Step 3: Parse Data
    steps = 0
    heart_rates = []
    sleep_hours = 0.0
    has_data_points = False

    buckets = raw_json_data.get("bucket", [])
    for bucket in buckets:
        for dataset in bucket.get("dataset", []):
            dataType = dataset.get("dataSourceId", "") or dataset.get("dataTypeName", "")
            points = dataset.get("point", [])
            if points:
                has_data_points = True

            for pt in points:
                # Steps
                for val in pt.get("value", []):
                    if "intVal" in val:
                        steps += val["intVal"]
                    elif "fpVal" in val and "step" in str(dataType).lower():
                        steps += int(val["fpVal"])

                # Heart rate
                if "heart_rate" in str(dataType).lower() or "bpm" in str(dataType).lower():
                    for val in pt.get("value", []):
                        if "fpVal" in val:
                            heart_rates.append(val["fpVal"])
                        elif "intVal" in val:
                            heart_rates.append(float(val["intVal"]))

                # Sleep
                if "sleep" in str(dataType).lower():
                    start_nano = int(pt.get("startTimeNanos", 0))
                    end_nano = int(pt.get("endTimeNanos", 0))
                    if end_nano > start_nano > 0:
                        duration_hrs = (end_nano - start_nano) / (1e9 * 3600.0)
                        sleep_hours += duration_hrs

    avg_heart_rate = int(sum(heart_rates) / len(heart_rates)) if heart_rates else None

    # Step 4: Evaluate Outcome 1 vs Outcome 2
    if not has_data_points or (steps == 0 and not avg_heart_rate and sleep_hours == 0.0):
        # OUTCOME 2: EMPTY RESPONSE
        user.google_fit_last_sync = datetime.utcnow()
        db.commit()
        outcome = {"status": "no_data_available", "message": "Connected but no recent activity data found in Google Fit", "data": None}
        logger.info(f"[GOOGLE FIT SYNC - OUTCOME 2: EMPTY RESPONSE] Successful API call returned 0 metrics for user_id={user.id}.")
        return outcome

    # OUTCOME 1: SUCCESS - Insert into sensor_readings with data_source="google_fit"
    reading = SensorReading(
        user_id=user.id,
        timestamp=datetime.utcnow(),
        data_source="google_fit",
        steps=steps,
        sleep_hours=round(sleep_hours, 1),
        heart_rate=avg_heart_rate,
        raw_json=response.text[:2000]
    )
    db.add(reading)

    # Recalculate Risk Score
    risk = calculate_mental_health_risk(
        steps=steps,
        sleep_hours=sleep_hours,
        heart_rate_bpm=avg_heart_rate
    )
    risk_history = RiskHistory(
        user_id=user.id,
        risk_score=risk["risk_score"],
        risk_level=risk["risk_level"],
        contributing_factors=risk["contributing_factors"],
        confidence=risk["confidence"]
    )
    db.add(risk_history)

    user.google_fit_last_sync = datetime.utcnow()
    db.commit()
    db.refresh(reading)

    outcome = {
        "status": "success",
        "message": "Google Fit telemetry pulled and recorded successfully",
        "data": {
            "steps": steps,
            "sleep_hours": round(sleep_hours, 1),
            "heart_rate": avg_heart_rate,
            "reading_id": reading.id,
            "raw_response": raw_json_data
        }
    }
    logger.info(f"[GOOGLE FIT SYNC - OUTCOME 1: SUCCESS] Parsed user_id={user.id}: steps={steps}, sleep={sleep_hours:.1f}h, heart_rate={avg_heart_rate}bpm.")
    return outcome


async def run_scheduled_google_fit_sync(db: Session) -> Dict[str, Any]:
    """
    Background job that loops through all connected Google Fit users and triggers get_google_fit_data.
    Per-user failure handling ensures one user's failure doesn't block others.
    """
    connected_users = db.query(User).filter(User.google_fit_refresh_token.isnot(None)).all()
    logger.info(f"[SCHEDULED SYNC] Starting Google Fit sync for {len(connected_users)} connected users...")

    results = {}
    for user in connected_users:
        try:
            res = await get_google_fit_data(user.id, db)
            results[user.id] = res
        except Exception as e:
            logger.error(f"[SCHEDULED SYNC ERROR] Exception syncing user_id={user.id}: {str(e)}", exc_info=True)
            results[user.id] = {"status": "error", "message": f"Unexpected exception: {str(e)}", "data": None}

    logger.info(f"[SCHEDULED SYNC COMPLETE] Processed {len(results)} user sync attempts.")
    return results
