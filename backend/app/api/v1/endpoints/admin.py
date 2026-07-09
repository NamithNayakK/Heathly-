from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.phq9_assessment import PHQ9Assessment
from app.models.wifi_sensor import SensorReading, DailyAggregate
from app.models.health_report import HealthReport
from app.models.user import User

router = APIRouter()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.role or "patient") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_consultant_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.role or "patient") not in ("consultant", "admin"):
        raise HTTPException(status_code=403, detail="Consultant or admin access required")
    return current_user


class RoleUpdateRequest(BaseModel):
    role: str


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role or "patient",
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    allowed = {"patient", "consultant", "admin"}
    if payload.role not in allowed:
        raise HTTPException(status_code=400, detail=f"Role must be one of: {', '.join(allowed)}")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role}


@router.get("/stats")
def platform_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_patients = db.query(func.count(User.id)).filter(User.role == "patient").scalar() or 0
    total_consultants = db.query(func.count(User.id)).filter(User.role == "consultant").scalar() or 0
    total_admins = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    total_assessments = db.query(func.count(PHQ9Assessment.id)).scalar() or 0
    total_sensor_records = db.query(func.count(SensorReading.id)).scalar() or 0
    total_health_reports = db.query(func.count(HealthReport.id)).scalar() or 0

    return {
        "total_users": total_users,
        "patients": total_patients,
        "consultants": total_consultants,
        "admins": total_admins,
        "total_assessments": total_assessments,
        "total_sensor_records": total_sensor_records,
    }


@router.get("/patients")
def list_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_consultant_or_admin),
):
    """List all patients — accessible by consultants and admins."""
    patients = db.query(User).filter(User.role == "patient").order_by(User.full_name).all()
    result = []
    for p in patients:
        last_assessment = (
            db.query(PHQ9Assessment)
            .filter(PHQ9Assessment.user_id == p.id)
            .order_by(PHQ9Assessment.created_at.desc())
            .first()
        )
        sensor_count = db.query(func.count(SensorReading.id)).filter(SensorReading.user_id == p.id).scalar() or 0
        result.append({
            "id": p.id,
            "email": p.email,
            "full_name": p.full_name,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "last_assessment": {
                "score": last_assessment.score,
                "risk_level": last_assessment.risk_level,
                "created_at": last_assessment.created_at.isoformat(),
            } if last_assessment else None,
            "sensor_records": sensor_count,
        })
    return {"patients": result}


@router.get("/patients/{patient_id}/sensor-data")
def get_patient_sensor_data(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_consultant_or_admin),
):
    """Get sensor data for a specific patient — for consultant sensor view."""
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    sensors = (
        db.query(SensorReading)
        .filter(SensorReading.user_id == patient_id)
        .order_by(SensorReading.created_at.desc())
        .limit(20)
        .all()
    )

    last_assessment = (
        db.query(PHQ9Assessment)
        .filter(PHQ9Assessment.user_id == patient_id)
        .order_by(PHQ9Assessment.created_at.desc())
        .first()
    )

    return {
        "patient": {
            "id": patient.id,
            "full_name": patient.full_name,
            "email": patient.email,
        },
        "sensor_records": [
            {
                "id": r.id,
                "heart_rate_variability": r.heart_rate_variability,
                "galvanic_skin_response": r.galvanic_skin_response,
                "sleep_duration_hours": r.sleep_duration_hours,
                "stress_index": r.stress_index,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ],
        "last_assessment": {
            "score": last_assessment.score,
            "risk_level": last_assessment.risk_level,
            "dominant_emotion": last_assessment.dominant_emotion,
            "mental_state_label": last_assessment.mental_state_label,
            "created_at": last_assessment.created_at.isoformat(),
        } if last_assessment else None,
    }
