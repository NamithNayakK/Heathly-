import logging
from datetime import datetime
from typing import Optional
import urllib.parse
import httpx
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import encrypt_token, decrypt_token
from app.db.session import get_db
from app.models.user import User
from app.models.wifi_sensor import SensorReading, RiskHistory
from app.services.risk_calculator import calculate_mental_health_risk
from app.services.google_fit_service import get_google_fit_data, run_scheduled_google_fit_sync

logger = logging.getLogger(__name__)

router = APIRouter()

GOOGLE_OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"

FITNESS_SCOPES = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
    "https://www.googleapis.com/auth/fitness.heart_rate.read"
]

class ManualSensorEntryRequest(BaseModel):
    steps: int = Field(..., ge=0, le=50000, description="Steps today (0 to 50,000)")
    sleep_hours: float = Field(..., ge=0.0, le=24.0, description="Sleep hours last night (0.0 to 24.0)")
    heart_rate: Optional[int] = Field(None, ge=30, le=220, description="Heart rate bpm (optional)")


@router.get("/connect")
def google_fit_connect(
    user_id: Optional[int] = None,
    redirect_override: Optional[str] = None
):
    """
    Initiates Google Fit OAuth 2.0 flow.
    Includes access_type=offline and prompt=consent to guarantee a refresh_token is returned.
    """
    client_id = settings.google_client_id or "demo_google_fit_client_id.apps.googleusercontent.com"
    redirect_uri = redirect_override or settings.google_redirect_uri or "http://localhost:8000/api/auth/google-fit/callback"

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(FITNESS_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": str(user_id) if user_id else "default_user"
    }

    url = f"{GOOGLE_OAUTH_AUTH_URL}?{urllib.parse.urlencode(params)}"
    logger.info(f"Redirecting user to Google Fit OAuth URL with client_id={settings.google_client_id[:10]}...")
    return RedirectResponse(url=url)


@router.get("/callback")
async def google_fit_callback(
    request: Request,
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Handles Google Fit OAuth 2.0 Callback.
    Explicitly handles 3 cases:
    a) Success: code exchanged for tokens, refresh token encrypted & saved to user row.
    b) Denial/Cancel: Google returns error param -> returns clear connection cancelled message.
    c) Token exchange error: logs raw Google API response -> surfaces user-friendly error message.
    """
    # CASE B: User denied or cancelled consent
    if error or not code:
        logger.warning(f"Google Fit OAuth consent denied or cancelled: error={error}")
        target_url = f"{settings.app_url}/dashboard?google_fit=cancelled&message=" + urllib.parse.quote("Connection cancelled")
        return RedirectResponse(url=target_url)

    # CASE A & C: Exchange authorization code for tokens
    try:
        redirect_uri = str(request.url).split("?")[0]
        if not redirect_uri.endswith("/api/auth/google-fit/callback") and not redirect_uri.endswith("/api/v1/auth/google-fit/callback"):
            redirect_uri = settings.google_redirect_uri

        logger.info(f"Attempting token exchange with code for redirect_uri={redirect_uri}")

        payload = {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(GOOGLE_OAUTH_TOKEN_URL, data=payload)

        if res.status_code != 200:
            raw_error = res.text
            logger.error(f"Google OAuth token exchange failed (HTTP {res.status_code}): {raw_error}")
            target_url = f"{settings.app_url}/dashboard?google_fit=error&message=" + urllib.parse.quote("Connection failed, please try again")
            return RedirectResponse(url=target_url)

        token_data = res.json()
        refresh_token = token_data.get("refresh_token")

        user = None
        if state and state.isdigit():
            user = db.query(User).filter(User.id == int(state)).first()

        if not user:
            user = db.query(User).filter(User.role == "patient").first() or db.query(User).first()

        if not user:
            logger.error("No user found in database to associate Google Fit refresh_token.")
            target_url = f"{settings.app_url}/dashboard?google_fit=error&message=" + urllib.parse.quote("User account not found")
            return RedirectResponse(url=target_url)

        if refresh_token:
            user.google_fit_refresh_token = encrypt_token(refresh_token)
        user.google_fit_connected_at = datetime.utcnow()
        db.commit()
        db.refresh(user)

        # Immediate sync right after OAuth connection completes
        try:
            from app.services.google_fit_service import get_google_fit_data
            await get_google_fit_data(user.id, db)
        except Exception as sync_err:
            logger.warning(f"Initial post-OAuth Google Fit sync warning: {sync_err}")

        logger.info(f"Successfully stored encrypted Google Fit refresh token and completed initial sync for user_id={user.id} ({user.email}).")
        target_url = f"{settings.app_url}/dashboard?google_fit=success&message=" + urllib.parse.quote("Google Fit connected successfully!")
        return RedirectResponse(url=target_url)

    except Exception as e:
        logger.error(f"Unexpected exception during Google Fit OAuth token exchange: {str(e)}", exc_info=True)
        target_url = f"{settings.app_url}/dashboard?google_fit=error&message=" + urllib.parse.quote("Connection failed, please try again")
        return RedirectResponse(url=target_url)


@router.get("/status")
def google_fit_status(
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns current Google Fit connection state cleanly for the frontend display:
    - 'not_connected' -> show Connect button
    - 'connected' -> show green status with last_synced_minutes_ago
    - 'expired' -> show 'Connection expired — please reconnect'
    - 'connected_no_data' -> show 'Connected but no recent data found'
    """
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    else:
        user = db.query(User).filter(User.role == "patient").first() or db.query(User).first()

    if not user or not user.google_fit_refresh_token:
        return {
            "user_id": user.id if user else None,
            "connected": False,
            "state_code": "not_connected",
            "status_display": "Not connected",
            "last_sync": None,
            "minutes_since_sync": None
        }

    if not user.google_fit_connected_at:
        return {
            "user_id": user.id,
            "connected": False,
            "state_code": "expired",
            "status_display": "Connection expired — please reconnect",
            "last_sync": None,
            "minutes_since_sync": None
        }

    minutes_ago = None
    if user.google_fit_last_sync:
        sync_time = user.google_fit_last_sync
        if sync_time.tzinfo is not None:
            sync_time = sync_time.replace(tzinfo=None)
        minutes_ago = int((datetime.utcnow() - sync_time).total_seconds() / 60)

    # Check latest sensor_readings row for data source
    latest_reading = db.query(SensorReading).filter(
        SensorReading.user_id == user.id,
        SensorReading.data_source == "google_fit"
    ).order_by(SensorReading.timestamp.desc()).first()

    state_code = "connected"
    status_display = f"Connected — last synced {minutes_ago if minutes_ago is not None else 0} min ago"

    if not latest_reading:
        state_code = "connected_no_data"
        status_display = "Connected but no recent data found"

    return {
        "user_id": user.id,
        "email": user.email,
        "connected": True,
        "state_code": state_code,
        "status_display": status_display,
        "connected_at": user.google_fit_connected_at.isoformat() if user.google_fit_connected_at else None,
        "last_sync": user.google_fit_last_sync.isoformat() if user.google_fit_last_sync else None,
        "minutes_since_sync": minutes_ago
    }


@router.post("/pull-now")
async def trigger_manual_pull(
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Manually triggers get_google_fit_data(user_id) to execute an on-demand sync.
    Prints & returns the exact 1 of 5 failure/success outcomes.
    """
    if not user_id:
        user = db.query(User).filter(User.role == "patient").first() or db.query(User).first()
        user_id = user.id if user else 1

    outcome = await get_google_fit_data(user_id, db)
    return outcome


@router.post("/manual")
def submit_manual_sensor_entry(
    payload: ManualSensorEntryRequest,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    PHASE 4: Manual Entry Fallback (Zero external dependency).
    Directly inserts telemetry into sensor_readings with data_source="manual".
    Includes basic validation (steps: 0-50000, sleep: 0-24).
    """
    if not user_id:
        user = db.query(User).filter(User.role == "patient").first() or db.query(User).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user.id

    reading = SensorReading(
        user_id=user_id,
        timestamp=datetime.utcnow(),
        data_source="manual",
        steps=payload.steps,
        sleep_hours=payload.sleep_hours,
        heart_rate=payload.heart_rate,
        raw_json=f'{{"source":"manual_entry", "steps":{payload.steps}, "sleep_hours":{payload.sleep_hours}}}'
    )
    db.add(reading)

    # Recalculate Risk Score
    risk = calculate_mental_health_risk(
        steps=payload.steps,
        sleep_hours=payload.sleep_hours,
        heart_rate_bpm=payload.heart_rate
    )
    risk_history = RiskHistory(
        user_id=user_id,
        risk_score=risk["risk_score"],
        risk_level=risk["risk_level"],
        contributing_factors=risk["contributing_factors"],
        confidence=risk["confidence"]
    )
    db.add(risk_history)
    db.commit()
    db.refresh(reading)

    logger.info(f"[MANUAL SENSOR ENTRY] Saved for user_id={user_id}: steps={payload.steps}, sleep={payload.sleep_hours}h, hr={payload.heart_rate}")
    return {
        "status": "success",
        "message": "Manual telemetry saved successfully",
        "data": {
            "id": reading.id,
            "user_id": user_id,
            "data_source": "manual",
            "steps": payload.steps,
            "sleep_hours": payload.sleep_hours,
            "heart_rate": payload.heart_rate,
            "risk_level": risk["risk_level"],
            "risk_score": risk["risk_score"]
        }
    }
