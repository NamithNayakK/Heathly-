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

    # Consultant verification fields
    registration_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    registration_body: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verification_status: Mapped[str | None] = mapped_column(String(50), nullable=True) # "approved", "rejected", "pending"
    verification_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Google Fit Integration fields
    google_fit_refresh_token: Mapped[str | None] = mapped_column(String(512), nullable=True)
    google_fit_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    google_fit_last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


