"""
Mobile Health Sync API — Phase 2

POST /api/v1/mobile-health/sync   — Batch ingestion from Healthly Companion Android APK
GET  /api/v1/mobile-health/today  — Today's aggregated metrics (authenticated patient)
GET  /api/v1/mobile-health/history — Historical readings
GET  /api/v1/mobile-health/trends  — Trend data for charts (7d / 30d)
GET  /api/v1/mobile-health/activity — Activity sessions
GET  /api/v1/mobile-health/status   — Last sync info and device status

Authentication: All routes require a valid JWT. User identity is derived exclusively
from the JWT claim — user_id is NEVER trusted from the request body.

Idempotency: source_record_id + user_id unique constraint prevents duplicate uploads.
"""
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.patient_assignment import PatientAssignment
from app.models.phq9_assessment import PHQ9Assessment
from app.models.user import User
from app.models.wifi_sensor import (
    DailyAggregate,
    MobileActivitySession,
    MobileGpsSession,
    MobileSensorFeatures,
    RiskHistory,
    SensorReading,
)
from app.services.risk_calculator import calculate_mental_health_risk

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── VALIDATION CONSTANTS ─────────────────────────────────────────────────────

MAX_STEPS_PER_RECORD = 100_000
MAX_DISTANCE_METERS = 200_000        # 200 km
MAX_CALORIES = 10_000
HEART_RATE_MIN = 20
HEART_RATE_MAX = 300
MAX_SLEEP_HOURS = 24.0
MAX_SCREEN_MINUTES = 1440            # 24 hours
MAX_CLOCK_SKEW_HOURS = 24            # reject timestamps >24h in the future
MAX_RECORDS_PER_BATCH = 500


# ─── HELPER: require real authenticated user (no guest fallback) ──────────────

def require_patient_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require a real authenticated user. Guest users are rejected."""
    if current_user.email == "guest@healthly.local":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )
    return current_user


def require_consultant_or_admin(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role or "patient"
    if role not in ("consultant", "admin"):
        raise HTTPException(status_code=403, detail="Consultant or admin access required")
    if role == "consultant" and current_user.verification_status != "approved":
        raise HTTPException(status_code=403, detail="Consultant verification pending")
    return current_user


# ─── PYDANTIC SCHEMAS ─────────────────────────────────────────────────────────

class MobileHealthRecord(BaseModel):
    """One sensor record in a batch sync payload."""
    metric_type: str = Field(..., description="steps | distance | calories | heart_rate | sleep | active_minutes | screen_time | activity | accelerometer | gyroscope")
    value: float
    unit: str = Field(..., description="count | meters | kcal | bpm | minutes | seconds")
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    recorded_at: str
    data_source: str = Field(..., description="health_connect | android_sensor | activity_recognition | gps | usage_stats | manual | google_fit")
    source_record_id: Optional[str] = None
    is_estimated: bool = False
    extra: Optional[Dict[str, Any]] = None  # additional metadata

    @field_validator("value")
    @classmethod
    def validate_value(cls, v, info):
        if v is None:
            return v
        metric = info.data.get("metric_type", "")
        if metric == "steps" and (v < 0 or v > MAX_STEPS_PER_RECORD):
            raise ValueError(f"Steps value {v} is out of valid range (0–{MAX_STEPS_PER_RECORD})")
        if metric == "distance" and (v < 0 or v > MAX_DISTANCE_METERS):
            raise ValueError(f"Distance {v}m is out of valid range")
        if metric == "calories" and (v < 0 or v > MAX_CALORIES):
            raise ValueError(f"Calories {v} is out of valid range")
        if metric == "heart_rate" and (v < HEART_RATE_MIN or v > HEART_RATE_MAX):
            raise ValueError(f"Heart rate {v} BPM is outside physiologically valid range ({HEART_RATE_MIN}–{HEART_RATE_MAX})")
        if metric == "sleep" and (v < 0 or v > MAX_SLEEP_HOURS * 60):
            raise ValueError(f"Sleep duration {v} minutes is out of valid range")
        if metric == "screen_time" and (v < 0 or v > MAX_SCREEN_MINUTES):
            raise ValueError(f"Screen time {v} minutes is out of valid range")
        return v

    @field_validator("recorded_at")
    @classmethod
    def validate_recorded_at(cls, v):
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            now_utc = datetime.now(timezone.utc)
            if dt > now_utc + timedelta(hours=MAX_CLOCK_SKEW_HOURS):
                raise ValueError(f"Timestamp is too far in the future: {v}")
        except ValueError as e:
            raise ValueError(f"Invalid timestamp format: {v} — {e}")
        return v

    @field_validator("data_source")
    @classmethod
    def validate_data_source(cls, v):
        allowed = {"health_connect", "android_sensor", "activity_recognition", "gps", "usage_stats", "manual", "google_fit"}
        if v not in allowed:
            raise ValueError(f"data_source must be one of: {allowed}")
        return v


class SensorFeatureRecord(BaseModel):
    """Processed accelerometer/gyroscope window features."""
    sensor_type: str  # "accelerometer" | "gyroscope"
    window_start: str
    window_end: str
    window_size_ms: Optional[int] = None
    mean_x: Optional[float] = None
    mean_y: Optional[float] = None
    mean_z: Optional[float] = None
    std_x: Optional[float] = None
    std_y: Optional[float] = None
    std_z: Optional[float] = None
    magnitude_mean: Optional[float] = None
    magnitude_std: Optional[float] = None
    movement_intensity: Optional[float] = Field(None, ge=0.0, le=1.0)
    source_record_id: Optional[str] = None

    @field_validator("sensor_type")
    @classmethod
    def validate_sensor_type(cls, v):
        if v not in ("accelerometer", "gyroscope"):
            raise ValueError("sensor_type must be 'accelerometer' or 'gyroscope'")
        return v


class ActivitySessionRecord(BaseModel):
    """One detected activity session from Activity Recognition API."""
    activity_type: str  # walking, running, cycling, vehicle, still, unknown
    start_time: str
    end_time: str
    duration_seconds: int = Field(ge=0)
    confidence: int = Field(ge=0, le=100)
    steps: Optional[int] = Field(None, ge=0)
    distance_meters: Optional[float] = Field(None, ge=0)
    calories: Optional[float] = Field(None, ge=0)
    source_record_id: Optional[str] = None


class GpsSessionRecord(BaseModel):
    """One GPS tracking session."""
    start_time: str
    end_time: str
    distance_meters: float = Field(ge=0)
    duration_seconds: int = Field(ge=0)
    average_speed_ms: Optional[float] = Field(None, ge=0)
    max_speed_ms: Optional[float] = Field(None, ge=0)
    route_point_count: int = Field(ge=0, default=0)
    source_record_id: Optional[str] = None


class ScreenTimeRecord(BaseModel):
    """Screen time data from UsageStatsManager. App content is NOT collected."""
    date: str  # YYYY-MM-DD
    total_minutes: int = Field(ge=0, le=MAX_SCREEN_MINUTES)
    social_minutes: Optional[int] = Field(None, ge=0)
    productivity_minutes: Optional[int] = Field(None, ge=0)
    entertainment_minutes: Optional[int] = Field(None, ge=0)
    unlock_count: Optional[int] = Field(None, ge=0)
    source_record_id: Optional[str] = None


class MobileSyncPayload(BaseModel):
    """Batch sync payload from Healthly Companion APK."""
    device_id: str = Field(..., min_length=1)
    app_version: Optional[str] = None
    records: List[MobileHealthRecord] = Field(default_factory=list, max_length=MAX_RECORDS_PER_BATCH)
    sensor_features: List[SensorFeatureRecord] = Field(default_factory=list)
    activity_sessions: List[ActivitySessionRecord] = Field(default_factory=list)
    gps_sessions: List[GpsSessionRecord] = Field(default_factory=list)
    screen_time: List[ScreenTimeRecord] = Field(default_factory=list)


# ─── NORMALIZATION HELPERS ────────────────────────────────────────────────────

UNIT_CONVERSIONS: Dict[str, Dict[str, float]] = {
    # metric_type -> {from_unit -> multiplier_to_canonical}
    "distance": {"km": 1000.0, "miles": 1609.344, "feet": 0.3048, "meters": 1.0},
    "sleep":    {"hours": 60.0, "minutes": 1.0, "seconds": 1 / 60.0},
    "screen_time": {"hours": 60.0, "minutes": 1.0},
    "calories": {"kj": 0.239006, "kcal": 1.0},
    "active_minutes": {"seconds": 1 / 60.0, "minutes": 1.0},
}


def normalize_value(value: float, metric_type: str, unit: str) -> float:
    """Convert a value to canonical unit. Returns value unchanged if no conversion needed."""
    conversions = UNIT_CONVERSIONS.get(metric_type, {})
    multiplier = conversions.get(unit.lower(), None)
    if multiplier is not None:
        return value * multiplier
    return value


def compute_record_hash(record_data: dict) -> str:
    """Compute a stable SHA-256 hash of the canonical record fields for deduplication."""
    canonical = {
        "metric_type": record_data.get("metric_type"),
        "value": round(record_data.get("value", 0), 4),
        "start_time": record_data.get("start_time"),
        "end_time": record_data.get("end_time"),
        "data_source": record_data.get("data_source"),
    }
    content = json.dumps(canonical, sort_keys=True, default=str)
    return hashlib.sha256(content.encode()).hexdigest()


def parse_dt(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        return None


# ─── POST /sync — BATCH INGESTION ─────────────────────────────────────────────

@router.post("/sync")
async def mobile_sync(
    payload: MobileSyncPayload,
    current_user: User = Depends(require_patient_or_admin),
    db: Session = Depends(get_db),
):
    """
    Ingest a batch of sensor records from the Healthly Companion Android APK.

    Authentication: JWT required. user_id is derived from the token — NOT from the request body.
    Idempotency: Records with duplicate source_record_id for this user are skipped (upserted).
    Normalization: All values are converted to canonical units server-side.
    Validation: Out-of-range or malformed values are rejected with 422.
    """
    user_id = current_user.id
    device_id = payload.device_id
    results = {
        "accepted": 0,
        "skipped_duplicate": 0,
        "rejected_invalid": 0,
        "errors": [],
    }

    # --- Associate device_id with user ---
    if not current_user.device_id and device_id:
        current_user.device_id = device_id
        db.add(current_user)

    # ── 1. Process regular sensor records ─────────────────────────────────────
    latest_steps = None
    latest_screen = None
    latest_sleep = None
    latest_hr = None
    latest_hrv = None

    for rec in payload.records:
        try:
            norm_value = normalize_value(rec.value, rec.metric_type, rec.unit)
            record_hash = compute_record_hash({
                "metric_type": rec.metric_type,
                "value": norm_value,
                "start_time": rec.start_time,
                "end_time": rec.end_time,
                "data_source": rec.data_source,
            })
            src_rec_id = rec.source_record_id

            # Check dedup by source_record_id (primary) or hash (secondary)
            existing = None
            if src_rec_id:
                existing = db.query(SensorReading).filter(
                    SensorReading.user_id == user_id,
                    SensorReading.source_record_id == src_rec_id,
                ).first()
            if not existing:
                existing = db.query(SensorReading).filter(
                    SensorReading.user_id == user_id,
                    SensorReading.source_record_hash == record_hash,
                ).first()

            recorded_at = parse_dt(rec.recorded_at) or datetime.utcnow()
            start_time = parse_dt(rec.start_time)
            end_time = parse_dt(rec.end_time)

            # Build field dict from metric_type
            fields: Dict[str, Any] = {
                "user_id": user_id,
                "device_id": device_id,
                "data_source": rec.data_source,
                "source_record_id": src_rec_id,
                "source_record_hash": record_hash,
                "is_estimated": rec.is_estimated,
                "timestamp": recorded_at,
                "start_time": start_time,
                "end_time": end_time,
                "updated_at": datetime.utcnow(),
            }

            mt = rec.metric_type
            if mt == "steps":
                fields["steps"] = int(norm_value)
                latest_steps = int(norm_value)
            elif mt == "distance":
                fields["distance_meters"] = norm_value
            elif mt == "calories":
                fields["calories"] = norm_value
            elif mt == "heart_rate":
                fields["heart_rate"] = int(norm_value)
                latest_hr = int(norm_value)
            elif mt == "sleep":
                # canonical: minutes → convert to hours for DB (existing schema stores hours)
                fields["sleep_hours"] = round(norm_value / 60.0, 2)
                latest_sleep = round(norm_value / 60.0, 2)
            elif mt == "active_minutes":
                fields["active_minutes"] = int(norm_value)
            elif mt == "screen_time":
                fields["screen_time_minutes"] = int(norm_value)
                latest_screen = int(norm_value)
            elif mt == "hrv":
                fields["hrv"] = norm_value
                latest_hrv = norm_value
            elif mt == "resting_heart_rate":
                fields["resting_heart_rate"] = int(norm_value)

            if existing:
                # Upsert — update mutable fields
                for k, v in fields.items():
                    if k not in ("user_id",) and v is not None:
                        setattr(existing, k, v)
                db.add(existing)
                results["skipped_duplicate"] += 1
            else:
                reading = SensorReading(**fields)
                db.add(reading)
                results["accepted"] += 1

        except Exception as e:
            results["rejected_invalid"] += 1
            results["errors"].append({"record": rec.metric_type, "error": str(e)})
            logger.warning(f"[MOBILE SYNC] Rejected record for user {user_id}: {e}")

    # ── 2. Process sensor feature windows ─────────────────────────────────────
    for feat in payload.sensor_features:
        try:
            src_id = feat.source_record_id
            existing = None
            if src_id:
                existing = db.query(MobileSensorFeatures).filter(
                    MobileSensorFeatures.user_id == user_id,
                    MobileSensorFeatures.source_record_id == src_id,
                ).first()
            if existing:
                results["skipped_duplicate"] += 1
                continue

            db.add(MobileSensorFeatures(
                user_id=user_id,
                device_id=device_id,
                sensor_type=feat.sensor_type,
                window_start=parse_dt(feat.window_start) or datetime.utcnow(),
                window_end=parse_dt(feat.window_end) or datetime.utcnow(),
                window_size_ms=feat.window_size_ms,
                mean_x=feat.mean_x,
                mean_y=feat.mean_y,
                mean_z=feat.mean_z,
                std_x=feat.std_x,
                std_y=feat.std_y,
                std_z=feat.std_z,
                magnitude_mean=feat.magnitude_mean,
                magnitude_std=feat.magnitude_std,
                movement_intensity=feat.movement_intensity,
                source_record_id=src_id,
                data_source="android_sensor",
            ))
            results["accepted"] += 1
        except Exception as e:
            results["rejected_invalid"] += 1
            results["errors"].append({"record": "sensor_feature", "error": str(e)})

    # ── 3. Process activity sessions ──────────────────────────────────────────
    for act in payload.activity_sessions:
        try:
            src_id = act.source_record_id
            existing = None
            if src_id:
                existing = db.query(MobileActivitySession).filter(
                    MobileActivitySession.user_id == user_id,
                    MobileActivitySession.source_record_id == src_id,
                ).first()
            if existing:
                results["skipped_duplicate"] += 1
                continue

            db.add(MobileActivitySession(
                user_id=user_id,
                device_id=device_id,
                activity_type=act.activity_type,
                start_time=parse_dt(act.start_time) or datetime.utcnow(),
                end_time=parse_dt(act.end_time) or datetime.utcnow(),
                duration_seconds=act.duration_seconds,
                confidence=act.confidence,
                steps=act.steps,
                distance_meters=act.distance_meters,
                calories=act.calories,
                source_record_id=src_id,
                data_source="activity_recognition",
            ))
            results["accepted"] += 1
        except Exception as e:
            results["rejected_invalid"] += 1
            results["errors"].append({"record": "activity_session", "error": str(e)})

    # ── 4. Process GPS sessions ───────────────────────────────────────────────
    for gps in payload.gps_sessions:
        try:
            src_id = gps.source_record_id
            existing = None
            if src_id:
                existing = db.query(MobileGpsSession).filter(
                    MobileGpsSession.user_id == user_id,
                    MobileGpsSession.source_record_id == src_id,
                ).first()
            if existing:
                results["skipped_duplicate"] += 1
                continue

            db.add(MobileGpsSession(
                user_id=user_id,
                device_id=device_id,
                start_time=parse_dt(gps.start_time) or datetime.utcnow(),
                end_time=parse_dt(gps.end_time) or datetime.utcnow(),
                distance_meters=gps.distance_meters,
                duration_seconds=gps.duration_seconds,
                average_speed_ms=gps.average_speed_ms,
                max_speed_ms=gps.max_speed_ms,
                route_point_count=gps.route_point_count,
                source_record_id=src_id,
                data_source="gps",
            ))
            results["accepted"] += 1
        except Exception as e:
            results["rejected_invalid"] += 1
            results["errors"].append({"record": "gps_session", "error": str(e)})

    # ── 5. Process screen-time records ────────────────────────────────────────
    for st in payload.screen_time:
        try:
            src_id = st.source_record_id
            existing = None
            if src_id:
                existing = db.query(SensorReading).filter(
                    SensorReading.user_id == user_id,
                    SensorReading.source_record_id == src_id,
                ).first()
            if existing:
                results["skipped_duplicate"] += 1
                continue

            db.add(SensorReading(
                user_id=user_id,
                device_id=device_id,
                data_source="usage_stats",
                source_record_id=src_id,
                timestamp=datetime.utcnow(),
                screen_time_minutes=st.total_minutes,
                social_app_minutes=st.social_minutes or 0,
                productivity_app_minutes=st.productivity_minutes or 0,
                entertainment_app_minutes=st.entertainment_minutes or 0,
                unlock_count=st.unlock_count or 0,
                updated_at=datetime.utcnow(),
            ))
            results["accepted"] += 1
        except Exception as e:
            results["rejected_invalid"] += 1
            results["errors"].append({"record": "screen_time", "error": str(e)})

    # ── Commit everything ─────────────────────────────────────────────────────
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        logger.error(f"[MOBILE SYNC] DB integrity error for user {user_id}: {e}")
        raise HTTPException(status_code=409, detail="Duplicate record detected. Use idempotent source_record_id.")

    # ── 6. Feed AI pipeline with latest available data ────────────────────────
    _trigger_risk_update(user_id, latest_steps, latest_screen, latest_sleep, latest_hr, latest_hrv, db)

    return {
        "status": "success",
        "device_id": device_id,
        "accepted": results["accepted"],
        "skipped_duplicate": results["skipped_duplicate"],
        "rejected_invalid": results["rejected_invalid"],
        "errors": results["errors"][:10],  # cap error list
        "synced_at": datetime.utcnow().isoformat(),
    }


def _trigger_risk_update(user_id: int, steps, screen, sleep_h, hr, hrv, db: Session):
    """After a sync, update the risk engine with the latest available values."""
    try:
        # Get latest reading for any fields not in this batch
        latest = (
            db.query(SensorReading)
            .filter(SensorReading.user_id == user_id)
            .order_by(SensorReading.timestamp.desc())
            .first()
        )
        latest_phq9 = (
            db.query(PHQ9Assessment)
            .filter(PHQ9Assessment.user_id == user_id)
            .order_by(PHQ9Assessment.created_at.desc())
            .first()
        )

        risk = calculate_mental_health_risk(
            steps=steps if steps is not None else (latest.steps if latest else 5000),
            screen_time_minutes=screen if screen is not None else (latest.screen_time_minutes if latest else 120),
            sleep_hours=sleep_h if sleep_h is not None else (latest.sleep_hours if latest else 7.0),
            heart_rate_bpm=hr if hr is not None else (latest.heart_rate if latest else None),
            hrv_ms=hrv if hrv is not None else (latest.hrv if latest else None),
            social_app_minutes=latest.social_app_minutes if latest else 30,
            notification_count=latest.notification_count if latest else 25,
            phq9_score=latest_phq9.score if latest_phq9 else None,
        )

        db.add(RiskHistory(
            user_id=user_id,
            risk_score=risk["risk_score"],
            risk_level=risk["risk_level"],
            contributing_factors=risk["contributing_factors"],
            phq9_component=risk["phq9_component"],
            phone_component=risk["phone_component"],
            confidence=risk["confidence"],
        ))
        db.commit()
    except Exception as e:
        logger.warning(f"[MOBILE SYNC] Risk update failed for user {user_id}: {e}")


# ─── GET /today ────────────────────────────────────────────────────────────────

@router.get("/today")
def get_today_metrics(
    current_user: User = Depends(require_patient_or_admin),
    db: Session = Depends(get_db),
):
    """Return today's aggregated sensor metrics for the authenticated patient."""
    user_id = current_user.id
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    readings = (
        db.query(SensorReading)
        .filter(
            SensorReading.user_id == user_id,
            SensorReading.timestamp >= today_start,
        )
        .all()
    )

    # Today's activity sessions
    activity_sessions = (
        db.query(MobileActivitySession)
        .filter(
            MobileActivitySession.user_id == user_id,
            MobileActivitySession.start_time >= today_start,
        )
        .all()
    )

    # GPS sessions today
    gps_sessions = (
        db.query(MobileGpsSession)
        .filter(
            MobileGpsSession.user_id == user_id,
            MobileGpsSession.start_time >= today_start,
        )
        .all()
    )

    # Latest risk
    latest_risk = (
        db.query(RiskHistory)
        .filter(RiskHistory.user_id == user_id)
        .order_by(RiskHistory.timestamp.desc())
        .first()
    )

    # Aggregate: take max steps (cumulative from Health Connect), sum calories, latest HR
    steps_records = [r for r in readings if r.steps and r.data_source in ("health_connect", "android_sensor")]
    hr_records = [r for r in readings if r.heart_rate]
    sleep_records = [r for r in readings if r.sleep_hours]
    screen_records = [r for r in readings if r.screen_time_minutes]
    calorie_records = [r for r in readings if r.calories]
    active_records = [r for r in readings if r.active_minutes]

    steps_val = max((r.steps for r in steps_records), default=None)
    hr_val = hr_records[-1].heart_rate if hr_records else None
    sleep_val = max((r.sleep_hours for r in sleep_records), default=None)
    screen_val = max((r.screen_time_minutes for r in screen_records), default=None)
    calories_val = max((r.calories for r in calorie_records), default=None)
    active_val = max((r.active_minutes for r in active_records), default=None)

    # Data source labels
    def _source(records, field):
        matching = [r for r in records if getattr(r, field)]
        return matching[-1].data_source if matching else None

    # GPS totals
    gps_total_km = round(sum(g.distance_meters for g in gps_sessions) / 1000.0, 2) if gps_sessions else None
    gps_session_count = len(gps_sessions)

    # Current/recent activity
    recent_activity = None
    if activity_sessions:
        latest_act = sorted(activity_sessions, key=lambda a: a.start_time)[-1]
        recent_activity = {
            "type": latest_act.activity_type,
            "start_time": latest_act.start_time.isoformat(),
            "end_time": latest_act.end_time.isoformat(),
            "duration_seconds": latest_act.duration_seconds,
            "confidence": latest_act.confidence,
        }

    return {
        "date": today_start.strftime("%Y-%m-%d"),
        "metrics": {
            "steps": {
                "value": steps_val,
                "unit": "count",
                "source": _source(steps_records, "steps"),
                "available": steps_val is not None,
            },
            "distance": {
                "value": round(max((r.distance_meters for r in readings if r.distance_meters), default=0) / 1000, 2) if readings else None,
                "unit": "km",
                "source": _source(readings, "distance_meters"),
                "available": any(r.distance_meters for r in readings),
            },
            "calories": {
                "value": round(calories_val, 1) if calories_val else None,
                "unit": "kcal",
                "is_estimated": any(r.is_estimated for r in calorie_records),
                "source": _source(calorie_records, "calories"),
                "available": calories_val is not None,
            },
            "heart_rate": {
                "value": hr_val,
                "unit": "bpm",
                "source": _source(hr_records, "heart_rate"),
                "available": hr_val is not None,
                "unavailable_reason": None if hr_val else "Not available on this device/source",
            },
            "sleep": {
                "value": round(sleep_val, 2) if sleep_val else None,
                "unit": "hours",
                "source": _source(sleep_records, "sleep_hours"),
                "available": sleep_val is not None,
                "unavailable_reason": None if sleep_val else "No Health Connect sleep source available",
            },
            "active_minutes": {
                "value": active_val,
                "unit": "minutes",
                "source": _source(active_records, "active_minutes"),
                "available": active_val is not None,
            },
            "screen_time": {
                "value": screen_val,
                "unit": "minutes",
                "source": "usage_stats" if screen_val else None,
                "available": screen_val is not None,
                "unavailable_reason": None if screen_val else "Usage Access not enabled",
            },
        },
        "current_activity": recent_activity,
        "gps_summary": {
            "session_count": gps_session_count,
            "total_km": gps_total_km,
            "available": gps_session_count > 0,
        },
        "risk": {
            "score": latest_risk.risk_score if latest_risk else None,
            "level": latest_risk.risk_level if latest_risk else None,
            "disclaimer": "Prototype / Experimental — not clinically validated",
        } if latest_risk else None,
    }


# ─── GET /history ──────────────────────────────────────────────────────────────

@router.get("/history")
def get_mobile_history(
    days: int = 7,
    current_user: User = Depends(require_patient_or_admin),
    db: Session = Depends(get_db),
):
    """Return historical sensor readings for the authenticated patient."""
    if days < 1 or days > 90:
        days = 7

    since = datetime.utcnow() - timedelta(days=days)
    readings = (
        db.query(SensorReading)
        .filter(
            SensorReading.user_id == current_user.id,
            SensorReading.timestamp >= since,
        )
        .order_by(SensorReading.timestamp.desc())
        .limit(500)
        .all()
    )

    return [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "data_source": r.data_source,
            "device_id": r.device_id,
            "steps": r.steps,
            "distance_km": round(r.distance_meters / 1000.0, 2) if r.distance_meters else None,
            "calories": r.calories,
            "is_estimated_calories": r.is_estimated,
            "heart_rate": r.heart_rate,
            "sleep_hours": r.sleep_hours,
            "screen_time_minutes": r.screen_time_minutes,
            "active_minutes": r.active_minutes,
        }
        for r in readings
    ]


# ─── GET /trends ───────────────────────────────────────────────────────────────

@router.get("/trends")
def get_mobile_trends(
    range: str = "7d",
    current_user: User = Depends(require_patient_or_admin),
    db: Session = Depends(get_db),
):
    """Return daily trend data for charts (7d, 30d). Sparse data is NOT interpolated."""
    days = 30 if range == "30d" else 7
    since = datetime.utcnow() - timedelta(days=days)

    readings = (
        db.query(SensorReading)
        .filter(
            SensorReading.user_id == current_user.id,
            SensorReading.timestamp >= since,
        )
        .order_by(SensorReading.timestamp.asc())
        .all()
    )

    # Group by date
    by_date: Dict[str, list] = {}
    for r in readings:
        date_key = r.timestamp.strftime("%Y-%m-%d")
        if date_key not in by_date:
            by_date[date_key] = []
        by_date[date_key].append(r)

    trends = []
    for date_str in sorted(by_date.keys()):
        day_readings = by_date[date_str]
        hr_vals = [r.heart_rate for r in day_readings if r.heart_rate]
        sleep_vals = [r.sleep_hours for r in day_readings if r.sleep_hours]
        screen_vals = [r.screen_time_minutes for r in day_readings if r.screen_time_minutes]

        trends.append({
            "date": date_str,
            "steps": max((r.steps for r in day_readings if r.steps), default=None),
            "distance_km": round(max((r.distance_meters for r in day_readings if r.distance_meters), default=0) / 1000, 2) or None,
            "calories": max((r.calories for r in day_readings if r.calories), default=None),
            "heart_rate_avg": round(sum(hr_vals) / len(hr_vals), 1) if hr_vals else None,
            "sleep_hours": max(sleep_vals, default=None),
            "screen_time_minutes": max(screen_vals, default=None),
            "active_minutes": max((r.active_minutes for r in day_readings if r.active_minutes), default=None),
            "has_data": True,
        })

    return {"range": range, "days": days, "trends": trends}


# ─── GET /activity ─────────────────────────────────────────────────────────────

@router.get("/activity")
def get_mobile_activity(
    days: int = 1,
    current_user: User = Depends(require_patient_or_admin),
    db: Session = Depends(get_db),
):
    """Return activity sessions and GPS sessions for the authenticated patient."""
    since = datetime.utcnow() - timedelta(days=max(1, min(days, 30)))

    activity_sessions = (
        db.query(MobileActivitySession)
        .filter(
            MobileActivitySession.user_id == current_user.id,
            MobileActivitySession.start_time >= since,
        )
        .order_by(MobileActivitySession.start_time.desc())
        .all()
    )

    gps_sessions = (
        db.query(MobileGpsSession)
        .filter(
            MobileGpsSession.user_id == current_user.id,
            MobileGpsSession.start_time >= since,
        )
        .order_by(MobileGpsSession.start_time.desc())
        .all()
    )

    return {
        "activity_sessions": [
            {
                "id": a.id,
                "activity_type": a.activity_type,
                "start_time": a.start_time.isoformat(),
                "end_time": a.end_time.isoformat(),
                "duration_minutes": round(a.duration_seconds / 60.0, 1),
                "confidence": a.confidence,
                "steps": a.steps,
                "distance_km": round(a.distance_meters / 1000, 2) if a.distance_meters else None,
                "calories": a.calories,
                "data_source": a.data_source,
            }
            for a in activity_sessions
        ],
        "gps_sessions": [
            {
                "id": g.id,
                "start_time": g.start_time.isoformat(),
                "end_time": g.end_time.isoformat(),
                "distance_km": round(g.distance_meters / 1000.0, 2),
                "duration_minutes": round(g.duration_seconds / 60.0, 1),
                "average_speed_kmh": round((g.average_speed_ms or 0) * 3.6, 1) if g.average_speed_ms else None,
                "max_speed_kmh": round((g.max_speed_ms or 0) * 3.6, 1) if g.max_speed_ms else None,
                "route_point_count": g.route_point_count,
                "data_source": g.data_source,
            }
            for g in gps_sessions
        ],
    }


# ─── GET /status ───────────────────────────────────────────────────────────────

@router.get("/status")
def get_mobile_sync_status(
    current_user: User = Depends(require_patient_or_admin),
    db: Session = Depends(get_db),
):
    """Return last sync timestamp, device info, and sensor source status."""
    user_id = current_user.id

    latest = (
        db.query(SensorReading)
        .filter(
            SensorReading.user_id == user_id,
            SensorReading.data_source.in_(["health_connect", "android_sensor", "activity_recognition", "gps", "usage_stats"]),
        )
        .order_by(SensorReading.created_at.desc())
        .first()
    )

    latest_gps = (
        db.query(MobileGpsSession)
        .filter(MobileGpsSession.user_id == user_id)
        .order_by(MobileGpsSession.created_at.desc())
        .first()
    )

    latest_activity = (
        db.query(MobileActivitySession)
        .filter(MobileActivitySession.user_id == user_id)
        .order_by(MobileActivitySession.created_at.desc())
        .first()
    )

    latest_features = (
        db.query(MobileSensorFeatures)
        .filter(MobileSensorFeatures.user_id == user_id)
        .order_by(MobileSensorFeatures.created_at.desc())
        .first()
    )

    # Determine last sync timestamp across all mobile tables
    sync_candidates = []
    if latest:
        sync_candidates.append(latest.created_at)
    if latest_gps:
        sync_candidates.append(latest_gps.created_at)
    if latest_activity:
        sync_candidates.append(latest_activity.created_at)

    last_sync = max(sync_candidates) if sync_candidates else None

    return {
        "device_id": current_user.device_id,
        "last_sync": last_sync.isoformat() if last_sync else None,
        "last_sync_relative": _relative_time(last_sync) if last_sync else "Never synced",
        "sources": {
            "health_connect": latest is not None and latest.data_source == "health_connect",
            "android_sensor": latest_features is not None,
            "activity_recognition": latest_activity is not None,
            "gps": latest_gps is not None,
            "usage_stats": latest is not None and latest.data_source == "usage_stats",
        },
        "record_counts": {
            "sensor_readings": db.query(SensorReading).filter(SensorReading.user_id == user_id).count(),
            "gps_sessions": db.query(MobileGpsSession).filter(MobileGpsSession.user_id == user_id).count(),
            "activity_sessions": db.query(MobileActivitySession).filter(MobileActivitySession.user_id == user_id).count(),
            "sensor_features": db.query(MobileSensorFeatures).filter(MobileSensorFeatures.user_id == user_id).count(),
        },
    }


def _relative_time(dt: datetime) -> str:
    now = datetime.utcnow()
    if dt.tzinfo:
        dt = dt.replace(tzinfo=None)
    diff = now - dt
    minutes = int(diff.total_seconds() / 60)
    if minutes < 1:
        return "Just now"
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    return f"{days}d ago"


# ─── GET /patient/{patient_id}/today — DOCTOR VIEW ────────────────────────────

@router.get("/patient/{patient_id}/today")
def get_patient_today_metrics(
    patient_id: int,
    current_user: User = Depends(require_consultant_or_admin),
    db: Session = Depends(get_db),
):
    """
    Doctor/admin view of a patient's today metrics.
    Enforces PatientAssignment — consultant can only view assigned patients.
    """
    # Authorization: verify patient is assigned to this consultant
    role = current_user.role or "patient"
    if role == "consultant":
        assignment = (
            db.query(PatientAssignment)
            .filter(
                PatientAssignment.patient_id == patient_id,
                PatientAssignment.consultant_id == current_user.id,
                PatientAssignment.status.in_(["assigned", "reassigned"]),
            )
            .first()
        )
        if not assignment:
            raise HTTPException(status_code=403, detail="Patient not assigned to you")

    # Verify patient exists
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Reuse same logic — temporarily impersonate patient_id
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    readings = (
        db.query(SensorReading)
        .filter(
            SensorReading.user_id == patient_id,
            SensorReading.timestamp >= today_start,
        )
        .all()
    )

    gps_sessions = (
        db.query(MobileGpsSession)
        .filter(MobileGpsSession.user_id == patient_id, MobileGpsSession.start_time >= today_start)
        .all()
    )

    activity_sessions = (
        db.query(MobileActivitySession)
        .filter(MobileActivitySession.user_id == patient_id, MobileActivitySession.start_time >= today_start)
        .all()
    )

    latest_risk = (
        db.query(RiskHistory)
        .filter(RiskHistory.user_id == patient_id)
        .order_by(RiskHistory.timestamp.desc())
        .first()
    )

    steps_val = max((r.steps for r in readings if r.steps), default=None)
    hr_val = next((r.heart_rate for r in reversed(readings) if r.heart_rate), None)
    sleep_val = max((r.sleep_hours for r in readings if r.sleep_hours), default=None)
    screen_val = max((r.screen_time_minutes for r in readings if r.screen_time_minutes), default=None)
    calories_val = max((r.calories for r in readings if r.calories), default=None)

    return {
        "patient_id": patient_id,
        "patient_name": patient.full_name,
        "date": today_start.strftime("%Y-%m-%d"),
        "steps": steps_val,
        "heart_rate": hr_val,
        "sleep_hours": sleep_val,
        "screen_time_minutes": screen_val,
        "calories": calories_val,
        "gps_sessions": len(gps_sessions),
        "activity_sessions": len(activity_sessions),
        "risk": {
            "score": latest_risk.risk_score,
            "level": latest_risk.risk_level,
            "disclaimer": "Prototype / Experimental — not clinically validated",
        } if latest_risk else None,
        "last_sync": max(
            (r.created_at for r in readings if r.created_at), default=None
        ),
    }
