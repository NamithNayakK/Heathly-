from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.chat_message import ChatMessage
from app.models.mood_log import MoodLog
from app.models.patient_assignment import PatientAssignment
from app.models.phq9_assessment import PHQ9Assessment
from app.models.user import User
from app.models.wifi_sensor import SensorReading
from app.schemas.chat import (
    ChatHistoryItem,
    ChatHistoryResponse,
    ChatRequest,
    ChatResponse,
    CompanionStatusResponse,
)
from app.services.chatbot import generate_cbt_response, get_companion_status
from app.services.webhook_service import send_webhook_to_n8n_risk_alert

router = APIRouter()


def _latest_phq9_context(db: Session, user_id: int) -> dict | None:
    latest = (
        db.query(PHQ9Assessment)
        .filter(PHQ9Assessment.user_id == user_id)
        .order_by(PHQ9Assessment.created_at.desc())
        .first()
    )
    if not latest:
        return None
    return {
        "score": latest.score,
        "risk_level": latest.risk_level,
        "needs_human_review": latest.needs_human_review,
        "created_at": latest.created_at.isoformat(),
    }


def _latest_sensor_context(db: Session, user_id: int) -> dict | None:
    cutoff = datetime.utcnow() - timedelta(hours=24)
    latest = (
        db.query(SensorReading)
        .filter(SensorReading.user_id == user_id, SensorReading.timestamp >= cutoff)
        .order_by(SensorReading.timestamp.desc())
        .first()
    )
    if not latest:
        return None
    return {
        "connected": True,
        "steps": getattr(latest, "steps", 0) or 0,
        "active_minutes": getattr(latest, "active_minutes", 0) or 0,
        "sleep_hours": getattr(latest, "sleep_hours", 0.0) or 0.0,
    }


@router.post("/message", response_model=ChatResponse)
async def chat_message(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    phq9_context = _latest_phq9_context(db, current_user.id)
    sensor_context = _latest_sensor_context(db, current_user.id)

    result = generate_cbt_response(payload.message, phq9_context, sensor_context)
    response = ChatResponse(**result)

    message = ChatMessage(
        user_id=current_user.id,
        user_message=payload.message,
        bot_response=response.response,
        emotion=response.emotion,
        confidence=response.confidence,
        escalation_required=response.escalation_required,
    )
    db.add(message)

    # Structured Check-In Mode: log mood entry tag in MoodLog
    if result.get("mode") == "check-in":
        mood_tag = result.get("mood_tag") or "general_checkin"
        mood_entry = MoodLog(
            user_id=current_user.id,
            mood_label=mood_tag,
            emoji="💬",
            val=50,
            intensity=60,
            note=f"Chat Check-in: {payload.message}",
        )
        db.add(mood_entry)

    # If crisis escalation triggered, mark latest PHQ-9 for human review so consultant triage queue highlights it
    if response.escalation_required:
        latest_assessment = (
            db.query(PHQ9Assessment)
            .filter(PHQ9Assessment.user_id == current_user.id)
            .order_by(PHQ9Assessment.created_at.desc())
            .first()
        )
        score_to_report = 27
        if latest_assessment:
            latest_assessment.needs_human_review = True
            latest_assessment.risk_level = "Severe (Crisis Escalation)"
            score_to_report = latest_assessment.score
        else:
            fallback_assessment = PHQ9Assessment(
                user_id=current_user.id,
                answers=[3, 3, 3, 3, 3, 3, 3, 3, 3],
                score=27,
                risk_level="Severe (Crisis Chat Escalation)",
                high_risk=True,
                recommended_action="Immediate Crisis Escalation - Patient routed to Crisis Triage",
                needs_human_review=True,
                dominant_emotion=response.emotion,
                emotion_confidence=response.confidence,
            )
            db.add(fallback_assessment)

        # Ensure patient assignment row exists for consultant triage queue
        assignment = db.query(PatientAssignment).filter(PatientAssignment.patient_id == current_user.id).first()
        if not assignment:
            assignment = PatientAssignment(patient_id=current_user.id, status="unassigned")
            db.add(assignment)

        db.commit()

        # Trigger existing n8n notification pipeline
        try:
            is_unassigned = assignment.status == "unassigned" or assignment.consultant_id is None
            await send_webhook_to_n8n_risk_alert(
                user_id=current_user.id,
                email=current_user.email,
                full_name=current_user.full_name,
                phq9_score=score_to_report,
                risk_level="Severe (Crisis Chat Escalation)",
                dominant_emotion=response.emotion,
                concern_areas=["Crisis Chat Escalation", "Self-Harm Risk"],
                is_unassigned=is_unassigned,
            )
        except Exception as exc:
            print(f"[Chat API] n8n risk alert webhook dispatch error: {exc}")
    else:
        db.commit()

    return response


@router.get("/companion-status", response_model=CompanionStatusResponse)
def companion_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanionStatusResponse:
    """Live wellbeing snapshot (latest PHQ-9 + latest sensor reading) for the companion widget."""
    phq9_context = _latest_phq9_context(db, current_user.id)
    sensor_context = _latest_sensor_context(db, current_user.id)
    return CompanionStatusResponse(**get_companion_status(phq9_context, sensor_context))


@router.get("/history", response_model=ChatHistoryResponse)
def chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatHistoryResponse:
    records = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .all()
    )

    return ChatHistoryResponse(
        items=[
            ChatHistoryItem(
                id=record.id,
                user_message=record.user_message,
                bot_response=record.bot_response,
                emotion=record.emotion,
                confidence=record.confidence,
                escalation_required=record.escalation_required,
                created_at=record.created_at.isoformat(),
            )
            for record in records
        ]
    )
