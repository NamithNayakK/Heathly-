from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.mood_log import MoodLog
from app.models.user import User
from app.schemas.mood_log import MoodLogCreate, MoodLogResponse

router = APIRouter()

@router.post("/", response_model=MoodLogResponse, status_code=status.HTTP_201_CREATED)
def create_mood_log(
    payload: MoodLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MoodLogResponse:
    entry = MoodLog(
        user_id=current_user.id,
        mood_label=payload.mood_label,
        emoji=payload.emoji,
        val=payload.val,
        intensity=payload.intensity,
        note=payload.note,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.get("/", response_model=list[MoodLogResponse])
def list_mood_logs(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MoodLogResponse]:
    return (
        db.query(MoodLog)
        .filter(MoodLog.user_id == current_user.id)
        .order_by(desc(MoodLog.created_at))
        .limit(limit)
        .all()
    )

@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mood_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(MoodLog).filter(MoodLog.id == log_id, MoodLog.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Mood log entry not found")
    db.delete(entry)
    db.commit()
    return None
