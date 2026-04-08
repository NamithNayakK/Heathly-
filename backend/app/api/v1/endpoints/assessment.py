from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.phq9_assessment import PHQ9Assessment
from app.models.user import User
from app.schemas.assessment import PHQ9HistoryItem, PHQ9HistoryResponse, PHQ9Request, PHQ9Response
from app.services.emotion_classifier import analyze_emotion
from app.services.phq9 import score_phq9
from app.services.recommendation_model import recommend_action
from app.services.risk_classifier import classify_assessment_risk
from app.services.webhook_service import send_webhook_to_n8n_risk_alert

router = APIRouter()


@router.post("/phq9", response_model=PHQ9Response)
async def submit_phq9(
    payload: PHQ9Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PHQ9Response:
    score_result = score_phq9(payload.answers)
    score = score_result.score
    risk_level = score_result.risk_level
    # Use a short synthetic summary to infer dominant emotion trend from PHQ-9 answers.
    emotion_label, _ = analyze_emotion(
        " ".join(
            [
                "low mood" if payload.answers[1] >= 2 else "stable mood",
                "low energy" if payload.answers[3] >= 2 else "normal energy",
                "sleep issues" if payload.answers[2] >= 2 else "sleep okay",
                "hopeless" if payload.answers[8] >= 1 else "safe",
            ]
        )
    )
    risk = classify_assessment_risk(payload.answers, score)

    response = PHQ9Response(
        score=score,
        risk_level=risk_level,
        high_risk=risk.high_risk,
        recommended_action=recommend_action(risk, emotion_label),
        risk_probability=risk.probability,
        emotional_score=score_result.breakdown.emotional,
        cognitive_score=score_result.breakdown.cognitive,
        physical_score=score_result.breakdown.physical,
        functional_score=score_result.breakdown.functional,
    )

    assessment = PHQ9Assessment(
        user_id=current_user.id,
        answers=payload.answers,
        score=response.score,
        risk_level=response.risk_level,
        high_risk=response.high_risk,
        recommended_action=response.recommended_action,
    )
    db.add(assessment)
    db.commit()

    # Trigger risk alert workflow if high-risk
    if response.high_risk:
        await send_webhook_to_n8n_risk_alert(
            user_id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
            phq9_score=response.score,
            risk_level=response.risk_level,
        )

    return response


@router.get("/phq9/history", response_model=PHQ9HistoryResponse)
def phq9_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PHQ9HistoryResponse:
    records = (
        db.query(PHQ9Assessment)
        .filter(PHQ9Assessment.user_id == current_user.id)
        .order_by(PHQ9Assessment.created_at.desc())
        .all()
    )

    return PHQ9HistoryResponse(
        items=[
            PHQ9HistoryItem(
                id=record.id,
                score=record.score,
                risk_level=record.risk_level,
                high_risk=record.high_risk,
                recommended_action=record.recommended_action,
                created_at=record.created_at.isoformat(),
            )
            for record in records
        ]
    )
