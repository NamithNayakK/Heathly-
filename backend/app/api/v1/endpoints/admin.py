from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.phq9_assessment import PHQ9Assessment
from app.models.wifi_sensor import SensorReading, DailyAggregate
from app.models.health_report import HealthReport
from app.models.forum_post import ForumPost
from app.models.user import User

router = APIRouter()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.role or "patient") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_consultant_or_admin(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role or "patient"
    if role not in ("consultant", "admin"):
        raise HTTPException(status_code=403, detail="Consultant or admin access required")
    if role == "consultant" and current_user.verification_status != "approved":
        raise HTTPException(status_code=403, detail="Consultant verification pending or rejected")
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
                "device_id": u.device_id,
                "paired": bool(u.device_id and str(u.device_id).strip()),
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
    if payload.role == "consultant":
        user.verification_status = "approved"
        user.verified_at = datetime.utcnow()
        user.verified_by = f"admin_{current_user.id}"
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role, "verification_status": user.verification_status}


@router.get("/stats")
def platform_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_patients = db.query(func.count(User.id)).filter(or_(User.role == "patient", User.role.is_(None))).scalar() or 0
    total_consultants = db.query(func.count(User.id)).filter(User.role == "consultant").scalar() or 0
    total_admins = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0

    # Total PHQ-9 assessments: all-time and last 7 days
    total_assessments_all_time = db.query(func.count(PHQ9Assessment.id)).scalar() or 0
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    total_assessments_last_7_days = (
        db.query(func.count(PHQ9Assessment.id))
        .filter(PHQ9Assessment.created_at >= seven_days_ago)
        .scalar()
        or 0
    )

    # Count of currently unresolved needs_human_review=true cases
    unresolved_reviews_count = (
        db.query(func.count(PHQ9Assessment.id))
        .filter(
            PHQ9Assessment.needs_human_review == True,
            PHQ9Assessment.reviewed_at.is_(None)
        )
        .scalar()
        or 0
    )

    # Risk level distribution across all patients (from most recent PHQ-9 assessment per patient)
    patients = db.query(User).filter(or_(User.role == "patient", User.role.is_(None))).all()
    risk_distribution = {"Low": 0, "Medium": 0, "High": 0, "Unassessed": 0}

    for patient in patients:
        latest = (
            db.query(PHQ9Assessment)
            .filter(PHQ9Assessment.user_id == patient.id)
            .order_by(PHQ9Assessment.created_at.desc())
            .first()
        )
        if not latest or not latest.risk_level:
            risk_distribution["Unassessed"] += 1
        else:
            rl = latest.risk_level.lower()
            if "high" in rl or "severe" in rl:
                risk_distribution["High"] += 1
            elif "mod" in rl or "medium" in rl:
                risk_distribution["Medium"] += 1
            else:
                risk_distribution["Low"] += 1

    total_sensor_records = db.query(func.count(SensorReading.id)).scalar() or 0

    return {
        "total_users": total_users,
        "patients": total_patients,
        "consultants": total_consultants,
        "admins": total_admins,
        "total_assessments": total_assessments_all_time,
        "assessments_submitted": {
            "all_time": total_assessments_all_time,
            "last_7_days": total_assessments_last_7_days,
        },
        "unresolved_reviews_count": unresolved_reviews_count,
        "risk_distribution": risk_distribution,
        "total_sensor_records": total_sensor_records,
    }


# --- FORUM MODERATION ENDPOINTS ---

@router.get("/forum/flagged")
def list_flagged_forum_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all forum posts flagged for review."""
    posts = (
        db.query(ForumPost, User)
        .join(User, ForumPost.user_id == User.id)
        .filter(ForumPost.is_flagged == True)
        .order_by(ForumPost.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": post.id,
                "title": post.title,
                "content": post.content,
                "author_name": user.full_name,
                "author_email": user.email,
                "is_flagged": post.is_flagged,
                "created_at": post.created_at.isoformat() if post.created_at else None,
            }
            for post, user in posts
        ]
    }


@router.post("/forum/{post_id}/approve")
def approve_flagged_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Approve a flagged post (clears is_flagged flag)."""
    post = db.query(ForumPost).filter(ForumPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Forum post not found")
    post.is_flagged = False
    db.commit()
    return {"status": "success", "id": post_id, "is_flagged": False}


@router.delete("/forum/{post_id}")
def remove_flagged_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Remove a post permanently."""
    post = db.query(ForumPost).filter(ForumPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Forum post not found")
    db.delete(post)
    db.commit()
    return {"status": "success", "id": post_id, "message": "Post removed"}



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
