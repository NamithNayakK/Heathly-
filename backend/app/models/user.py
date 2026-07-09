from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="patient", server_default="patient", nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    device_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

