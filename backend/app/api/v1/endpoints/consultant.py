"""Consultant dashboard API — triage queue, patient detail, mark-reviewed."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.health_report import HealthReport
from app.models.phq9_assessment import PHQ9Assessment
from app.models.user import User
from app.models.wifi_sensor import RiskHistory
from app.models.patient_assignment import PatientAssignment

router = APIRouter()



def require_consultant(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.role or "patient") != "consultant":
        raise HTTPException(status_code=403, detail="Consultant access required")
    if current_user.verification_status != "approved":
        raise HTTPException(status_code=403, detail="Consultant verification pending or rejected")
    return current_user


@router.websocket("/ws/session/{session_id}")
async def consultant_session_ws(websocket: WebSocket, session_id: str):
    """Router-based WebSocket endpoint for consultant live session feed."""
    from jose import jwt, JWTError
    from app.core.config import settings
    from app.db.session import SessionLocal
    from app.services.consultant_ws import consultant_session_manager

    db = SessionLocal()
    try:
        token = websocket.query_params.get("token")
        if not token:
            auth_header = websocket.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        user = None
        if token:
            try:
                payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
                subject = payload.get("sub")
                if subject:
                    user = db.query(User).filter(User.email == subject).first()
            except JWTError:
                pass

        if not user or (user.role or "patient") not in ["consultant", "admin"]:
            await websocket.close(code=4003, reason="Forbidden: Only consultants and admins can access live session feeds.")
            return

        await consultant_session_manager.connect(session_id, websocket)
        await websocket.send_json({
            "event": "connected",
            "session_id": session_id,
            "status": "connected",
            "message": f"Subscribed to live session feed for session '{session_id}'"
        })

        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"event": "pong"})
    except WebSocketDisconnect:
        consultant_session_manager.disconnect(session_id, websocket)
    except Exception as e:
        consultant_session_manager.disconnect(session_id, websocket)
    finally:
        db.close()



# ─── 1. TRIAGE QUEUE ────────────────────────────────────────────────
@router.get("/queue")
def get_triage_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_consultant),
):
    """Return patients assigned to this consultant who have assessments or need review.
    Also includes unassigned high-risk/urgent patients as a global safety fallback."""

    # 1. Patients specifically assigned to this consultant
    assigned_ids = [
        pa.patient_id for pa in db.query(PatientAssignment)
        .filter(
            PatientAssignment.consultant_id == current_user.id,
            PatientAssignment.status.in_(["assigned", "reassigned"])
        ).all()
    ]

    # 2. Safety fallback: Unassigned patients with High/Severe risk or needs_human_review=true
    unassigned_patient_ids = [
        pa.patient_id for pa in db.query(PatientAssignment)
        .filter(PatientAssignment.status == "unassigned")
        .all()
    ]
    
    urgent_unassigned_ids = set()
    if unassigned_patient_ids:
        urgent_assessments = (
            db.query(PHQ9Assessment.user_id)
            .filter(
                PHQ9Assessment.user_id.in_(unassigned_patient_ids),
                or_(
                    PHQ9Assessment.risk_level.ilike("%high%"),
                    PHQ9Assessment.risk_level.ilike("%severe%"),
                    PHQ9Assessment.needs_human_review == True,
                )
            )
            .all()
        )
        urgent_unassigned_ids = {u for (u,) in urgent_assessments}

    allowed_ids = set(assigned_ids) | urgent_unassigned_ids

    if not allowed_ids:
        return {"patients": []}

    patients = (
        db.query(User)
        .filter(User.id.in_(allowed_ids), User.role == "patient")
        .all()
    )

    result = []
    for p in patients:
        latest = (
            db.query(PHQ9Assessment)
            .filter(PHQ9Assessment.user_id == p.id)
            .order_by(desc(PHQ9Assessment.created_at))
            .first()
        )
        is_unassigned_fallback = p.id in urgent_unassigned_ids and p.id not in assigned_ids

        result.append({
            "id": p.id,
            "full_name": p.full_name,
            "email": p.email,
            "latest_risk_level": latest.risk_level if latest else None,
            "latest_score": latest.score if latest else None,
            "needs_review": bool(latest.needs_human_review) if latest else False,
            "last_assessment_date": latest.created_at.isoformat() if latest else None,
            "dominant_emotion": latest.dominant_emotion if latest else None,
            "is_unassigned_fallback": is_unassigned_fallback,
        })

    # Sort: needs_review=true first, then by risk severity
    risk_rank = {"severe": 0, "moderately severe": 1, "moderate": 2, "mild": 3, "minimal": 4}

    def sort_key(item):
        review_priority = 0 if item["needs_review"] else 1
        rl = (item["latest_risk_level"] or "minimal").lower()
        risk_priority = next(
            (v for k, v in risk_rank.items() if k in rl), 5
        )
        return (review_priority, risk_priority)

    result.sort(key=sort_key)
    return {"patients": result}


# ─── 2. PATIENT DETAIL ──────────────────────────────────────────────
@router.get("/patient/{patient_id}")
def get_patient_detail(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_consultant),
):
    """Full clinical detail for a single patient — strictly enforced assignment access control."""
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Access control: verify patient is assigned to current consultant (or is an unassigned high-risk fallback)
    assignment = db.query(PatientAssignment).filter(PatientAssignment.patient_id == patient_id).first()
    is_assigned = assignment and assignment.consultant_id == current_user.id and assignment.status in ["assigned", "reassigned"]

    if not is_assigned:
        # Check fallback for unassigned urgent case
        is_urgent_unassigned = False
        if assignment and assignment.status == "unassigned":
            urgent_check = db.query(PHQ9Assessment).filter(
                PHQ9Assessment.user_id == patient_id,
                or_(
                    PHQ9Assessment.risk_level.ilike("%high%"),
                    PHQ9Assessment.risk_level.ilike("%severe%"),
                    PHQ9Assessment.needs_human_review == True,
                )
            ).first()
            if urgent_check:
                is_urgent_unassigned = True

        if not is_urgent_unassigned:
            raise HTTPException(status_code=403, detail="Access denied: Patient is not assigned to you")

    # All PHQ-9 assessments (for line chart)
    assessments = (
        db.query(PHQ9Assessment)
        .filter(PHQ9Assessment.user_id == patient_id)
        .order_by(PHQ9Assessment.created_at.asc())
        .all()
    )

    # Risk history
    risks = (
        db.query(RiskHistory)
        .filter(RiskHistory.user_id == patient_id)
        .order_by(RiskHistory.timestamp.asc())
        .all()
    )

    # Health reports
    reports = (
        db.query(HealthReport)
        .filter(HealthReport.user_id == patient_id)
        .order_by(HealthReport.created_at.desc())
        .limit(10)
        .all()
    )

    latest = assessments[-1] if assessments else None

    return {
        "patient": {
            "id": patient.id,
            "full_name": patient.full_name,
            "email": patient.email,
            "created_at": patient.created_at.isoformat() if patient.created_at else None,
        },
        "assessments": [
            {
                "id": a.id,
                "score": a.score,
                "risk_level": a.risk_level,
                "needs_human_review": a.needs_human_review,
                "clinical_note": a.clinical_note,
                "dominant_emotion": a.dominant_emotion,
                "emotion_confidence": a.emotion_confidence,
                "emotional_score": a.emotional_score,
                "cognitive_score": a.cognitive_score,
                "physical_score": a.physical_score,
                "functional_score": a.functional_score,
                "concern_areas": a.concern_areas,
                "risk_flags": a.risk_flags,
                "mental_state_label": a.mental_state_label,
                "created_at": a.created_at.isoformat(),
            }
            for a in assessments
        ],
        "risk_history": [
            {
                "risk_score": r.risk_score,
                "risk_level": r.risk_level,
                "contributing_factors": r.contributing_factors,
                "timestamp": r.timestamp.isoformat(),
            }
            for r in risks
        ],
        "health_reports": [
            {
                "id": r.id,
                "filename": r.filename,
                "summary": r.summary,
                "diagnoses": r.diagnoses,
                "medications": r.medications,
                "created_at": r.created_at.isoformat(),
            }
            for r in reports
        ],
        "latest_assessment": {
            "id": latest.id,
            "score": latest.score,
            "risk_level": latest.risk_level,
            "dominant_emotion": latest.dominant_emotion,
            "emotional_score": latest.emotional_score,
            "cognitive_score": latest.cognitive_score,
            "physical_score": latest.physical_score,
            "functional_score": latest.functional_score,
            "concern_areas": latest.concern_areas,
            "risk_flags": latest.risk_flags,
            "needs_human_review": latest.needs_human_review,
            "clinical_note": latest.clinical_note,
        } if latest else None,
    }


# ─── 3. MARK REVIEWED + SAVE NOTE ───────────────────────────────────
class ReviewPayload(BaseModel):
    clinical_note: str | None = None


@router.post("/patient/{patient_id}/review/{assessment_id}")
def mark_reviewed(
    patient_id: int,
    assessment_id: int,
    payload: ReviewPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_consultant),
):
    """Mark a PHQ-9 assessment as reviewed and optionally save a clinical note."""
    # Access control verification
    assignment = db.query(PatientAssignment).filter(PatientAssignment.patient_id == patient_id).first()
    is_assigned = assignment and assignment.consultant_id == current_user.id and assignment.status in ["assigned", "reassigned"]

    if not is_assigned:
        is_urgent_unassigned = False
        if assignment and assignment.status == "unassigned":
            urgent_check = db.query(PHQ9Assessment).filter(
                PHQ9Assessment.user_id == patient_id,
                or_(
                    PHQ9Assessment.risk_level.ilike("%high%"),
                    PHQ9Assessment.risk_level.ilike("%severe%"),
                    PHQ9Assessment.needs_human_review == True,
                )
            ).first()
            if urgent_check:
                is_urgent_unassigned = True

        if not is_urgent_unassigned:
            raise HTTPException(status_code=403, detail="Access denied: Patient is not assigned to you")

    assessment = (
        db.query(PHQ9Assessment)
        .filter(
            PHQ9Assessment.id == assessment_id,
            PHQ9Assessment.user_id == patient_id,
        )
        .first()
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    assessment.needs_human_review = False
    assessment.reviewed_by_id = current_user.id
    assessment.reviewed_at = datetime.utcnow()
    if payload.clinical_note is not None:
        assessment.clinical_note = payload.clinical_note

    db.commit()
    db.refresh(assessment)

    return {
        "id": assessment.id,
        "needs_human_review": assessment.needs_human_review,
        "clinical_note": assessment.clinical_note,
        "reviewed_at": assessment.reviewed_at.isoformat() if assessment.reviewed_at else None,
    }

