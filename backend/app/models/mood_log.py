from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

class MoodLog(Base):
    __tablename__ = "mood_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    mood_label: Mapped[str] = mapped_column(String(50), nullable=False)
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)
    val: Mapped[int] = mapped_column(Integer, nullable=False)
    intensity: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
