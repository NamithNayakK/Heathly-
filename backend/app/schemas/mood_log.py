from datetime import datetime
from pydantic import BaseModel

class MoodLogCreate(BaseModel):
    mood_label: str
    emoji: str
    val: int
    intensity: int = 50
    note: str | None = None

class MoodLogResponse(BaseModel):
    id: int
    user_id: int
    mood_label: str
    emoji: str
    val: int
    intensity: int
    note: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
