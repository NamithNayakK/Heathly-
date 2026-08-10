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
from app.models.patient_assignment import PatientAssignment


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
    """List patients — accessible by consultants (their assigned patients only) and admins (all patients)."""
    user_role = current_user.role or "patient"
    if user_role == "consultant":
        patients = (
            db.query(User)
            .join(PatientAssignment, User.id == PatientAssignment.patient_id)
            .filter(
                User.role == "patient",
                PatientAssignment.consultant_id == current_user.id,
                PatientAssignment.status.in_(["assigned", "reassigned"])
            )
            .order_by(User.full_name)
            .all()
        )
    else:
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
    """Get sensor data for a specific patient — enforced access control for consultants."""
    user_role = current_user.role or "patient"
    if user_role == "consultant":
        assignment = (
            db.query(PatientAssignment)
            .filter(
                PatientAssignment.patient_id == patient_id,
                PatientAssignment.consultant_id == current_user.id,
                PatientAssignment.status.in_(["assigned", "reassigned"])
            )
            .first()
        )
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied: Patient is not assigned to you")

    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    records = (
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


# --- PATIENT ASSIGNMENT MANAGEMENT ENDPOINTS ---

class AssignPatientRequest(BaseModel):
    consultant_id: int


@router.get("/assignments/pending")
def list_pending_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all unassigned patients sorted by registration date (oldest first)."""
    # Ensure all patients have a PatientAssignment record
    all_patients = db.query(User).filter(User.role == "patient").all()
    for p in all_patients:
        pa = db.query(PatientAssignment).filter(PatientAssignment.patient_id == p.id).first()
        if not pa:
            pa = PatientAssignment(
                patient_id=p.id,
                status="unassigned",
                created_at=p.created_at or datetime.utcnow()
            )
            db.add(pa)
    db.commit()

    pending = (
        db.query(PatientAssignment, User)
        .join(User, PatientAssignment.patient_id == User.id)
        .filter(PatientAssignment.status == "unassigned")
        .order_by(PatientAssignment.created_at.asc())
        .all()
    )

    available_consultants = (
        db.query(User)
        .filter(User.role == "consultant", User.verification_status == "approved")
        .order_by(User.full_name)
        .all()
    )

    pending_list = []
    for assignment, patient in pending:
        latest_assessment = (
            db.query(PHQ9Assessment)
            .filter(PHQ9Assessment.user_id == patient.id)
            .order_by(PHQ9Assessment.created_at.desc())
            .first()
        )
        is_urgent = False
        urgent_reason = None
        if latest_assessment:
            q9 = 0
            if latest_assessment.answers and isinstance(latest_assessment.answers, dict):
                q9 = int(latest_assessment.answers.get("8", 0) or 0)
            if latest_assessment.needs_human_review or latest_assessment.risk_level == "High" or q9 > 0:
                is_urgent = True
                urgent_reason = f"High Risk / Q9 Flag (Score: {latest_assessment.score})"

        pending_list.append({
            "assignment_id": assignment.id,
            "patient_id": patient.id,
            "full_name": patient.full_name,
            "email": patient.email,
            "registered_at": (
                assignment.created_at.isoformat() if assignment.created_at
                else patient.created_at.isoformat() if patient.created_at
                else None
            ),
            "status": assignment.status,
            "is_urgent": is_urgent,
            "urgent_reason": urgent_reason,
            "latest_score": latest_assessment.score if latest_assessment else None,
            "latest_risk_level": latest_assessment.risk_level if latest_assessment else None,
        })

    return {
        "pending_patients": pending_list,
        "pending_count": len(pending_list),
        "available_consultants": [
            {
                "id": c.id,
                "full_name": c.full_name,
                "email": c.email,
                "registration_number": c.registration_number,
                "verification_status": c.verification_status,
            }
            for c in available_consultants
        ],
    }


@router.get("/assignments/assigned")
def list_assigned_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all currently assigned patients with consultant details and status warnings."""
    assigned = (
        db.query(PatientAssignment, User)
        .join(User, PatientAssignment.patient_id == User.id)
        .filter(PatientAssignment.status.in_(["assigned", "reassigned"]))
        .order_by(PatientAssignment.assigned_at.desc())
        .all()
    )

    result = []
    for assignment, patient in assigned:
        consultant = (
            db.query(User).filter(User.id == assignment.consultant_id).first()
            if assignment.consultant_id
            else None
        )
        assigned_by_user = (
            db.query(User).filter(User.id == assignment.assigned_by).first()
            if assignment.assigned_by
            else None
        )

        consultant_unverified = bool(consultant and consultant.verification_status != "approved")

        result.append({
            "assignment_id": assignment.id,
            "patient_id": patient.id,
            "patient_name": patient.full_name,
            "patient_email": patient.email,
            "consultant_id": consultant.id if consultant else None,
            "consultant_name": consultant.full_name if consultant else "Unassigned",
            "consultant_email": consultant.email if consultant else None,
            "consultant_verification_status": consultant.verification_status if consultant else None,
            "consultant_unverified_warning": consultant_unverified,
            "assigned_by_id": assigned_by_user.id if assigned_by_user else None,
            "assigned_by_name": assigned_by_user.full_name if assigned_by_user else "Admin",
            "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
            "status": assignment.status,
        })

    return {"assigned_patients": result}


@router.post("/assignments/{patient_id}/assign")
def assign_patient_to_consultant(
    patient_id: int,
    payload: AssignPatientRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Manually assign or reassign a patient to an approved consultant."""
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    consultant = db.query(User).filter(User.id == payload.consultant_id, User.role == "consultant").first()
    if not consultant:
        raise HTTPException(status_code=404, detail="Consultant not found")

    if consultant.verification_status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign patient to unverified consultant (Status: {consultant.verification_status}). Only approved consultants can be assigned."
        )

    assignment = db.query(PatientAssignment).filter(PatientAssignment.patient_id == patient_id).first()
    prev_status = assignment.status if assignment else "unassigned"
    new_status = "reassigned" if prev_status in ("assigned", "reassigned") else "assigned"

    if not assignment:
        assignment = PatientAssignment(
            patient_id=patient_id,
            consultant_id=consultant.id,
            assigned_by=current_user.id,
            assigned_at=datetime.utcnow(),
            status=new_status,
            created_at=patient.created_at or datetime.utcnow(),
        )
        db.add(assignment)
    else:
        assignment.consultant_id = consultant.id
        assignment.assigned_by = current_user.id
        assignment.assigned_at = datetime.utcnow()
        assignment.status = new_status

    db.commit()
    db.refresh(assignment)

    return {
        "success": True,
        "message": f"Patient '{patient.full_name}' successfully assigned to Dr. {consultant.full_name}",
        "assignment": {
            "id": assignment.id,
            "patient_id": patient.id,
            "patient_name": patient.full_name,
            "consultant_id": consultant.id,
            "consultant_name": consultant.full_name,
            "assigned_by": current_user.full_name,
            "assigned_at": assignment.assigned_at.isoformat(),
            "status": assignment.status,
        }
    }

