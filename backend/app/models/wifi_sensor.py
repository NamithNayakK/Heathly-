from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, JSON, Boolean, func, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base

class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False, index=True)
    data_source: Mapped[str] = mapped_column(String(50), default="unknown", server_default="unknown", nullable=False, index=True)

    # --- Mobile idempotency fields ---
    device_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    source_record_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    source_record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_estimated: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    # --- Measurement window (for Health Connect records) ---
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Activity ---
    steps: Mapped[int] = mapped_column(Integer, default=0)
    distance_meters: Mapped[float] = mapped_column(Float, default=0.0)
    calories: Mapped[float] = mapped_column(Float, default=0.0)
    active_minutes: Mapped[int] = mapped_column(Integer, default=0)

    # --- Screen ---
    is_screen_on: Mapped[bool] = mapped_column(Boolean, default=False)
    screen_time_minutes: Mapped[int] = mapped_column(Integer, default=0)
    screen_brightness: Mapped[int] = mapped_column(Integer, default=0)
    unlock_count: Mapped[int] = mapped_column(Integer, default=0)

    # --- Heart ---
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resting_heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hrv: Mapped[float | None] = mapped_column(Float, nullable=True)
    galvanic_skin_response: Mapped[float | None] = mapped_column(Float, nullable=True)
    stress_index: Mapped[float | None] = mapped_column(Float, nullable=True)

    # --- Sleep ---
    sleep_hours: Mapped[float] = mapped_column(Float, default=0.0)
    sleep_quality: Mapped[int] = mapped_column(Integer, default=0)
    bedtime: Mapped[str | None] = mapped_column(String(50), nullable=True)
    wake_time: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # --- Battery ---
    battery_level: Mapped[int] = mapped_column(Integer, default=100)
    is_charging: Mapped[bool] = mapped_column(Boolean, default=False)
    battery_temperature: Mapped[float] = mapped_column(Float, default=25.0)

    # --- App usage ---
    current_app: Mapped[str] = mapped_column(String(255), default="")
    social_app_minutes: Mapped[int] = mapped_column(Integer, default=0)
    productivity_app_minutes: Mapped[int] = mapped_column(Integer, default=0)
    entertainment_app_minutes: Mapped[int] = mapped_column(Integer, default=0)

    # --- Network ---
    connection_type: Mapped[str] = mapped_column(String(50), default="none")
    wifi_ssid: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # --- Notifications ---
    notification_count: Mapped[int] = mapped_column(Integer, default=0)
    social_notifications_count: Mapped[int] = mapped_column(Integer, default=0)

    # --- Location ---
    unique_locations: Mapped[int] = mapped_column(Integer, default=0)
    is_at_home: Mapped[bool] = mapped_column(Boolean, default=False)

    raw_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, onupdate=func.now())

    __table_args__ = (
        # Idempotency: one source_record_id per user (prevents duplicate uploads from APK)
        UniqueConstraint("user_id", "source_record_id", name="uq_sensor_user_source_record"),
        # Composite index for dashboard queries: user + time range
        Index("ix_sensor_user_timestamp", "user_id", "timestamp"),
        # Composite index for mobile sync queries
        Index("ix_sensor_user_source", "user_id", "data_source"),
    )


class DailyAggregate(Base):
    __tablename__ = "daily_aggregates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # "YYYY-MM-DD"

    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    avg_screen_time: Mapped[float] = mapped_column(Float, default=0.0)
    avg_heart_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_sleep_hours: Mapped[float] = mapped_column(Float, default=0.0)

    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(20), default="Low")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RiskHistory(Base):
    __tablename__ = "risk_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)

    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(20), default="Low")
    contributing_factors: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    phq9_component: Mapped[float] = mapped_column(Float, default=0.0)
    phone_component: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ─── NEW TABLES FOR NATIVE ANDROID MOBILE DATA ────────────────────────────────

class MobileGpsSession(Base):
    """GPS journey session — a tracked movement period from the Android APK."""
    __tablename__ = "mobile_gps_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    device_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    distance_meters: Mapped[float] = mapped_column(Float, default=0.0)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    average_speed_ms: Mapped[float | None] = mapped_column(Float, nullable=True)  # m/s
    max_speed_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    route_point_count: Mapped[int] = mapped_column(Integer, default=0)

    # Idempotency
    source_record_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    data_source: Mapped[str] = mapped_column(String(50), default="gps", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "source_record_id", name="uq_gps_user_source_record"),
        Index("ix_gps_user_start", "user_id", "start_time"),
    )


class MobileActivitySession(Base):
    """Detected activity session from Android Activity Recognition API."""
    __tablename__ = "mobile_activity_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    device_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # walking, running, cycling, vehicle, still, unknown
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[int] = mapped_column(Integer, default=0)  # 0-100 from Activity Recognition API

    steps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    distance_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    calories: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Idempotency
    source_record_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    data_source: Mapped[str] = mapped_column(String(50), default="activity_recognition", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "source_record_id", name="uq_activity_user_source_record"),
        Index("ix_activity_user_start", "user_id", "start_time"),
    )


class MobileSensorFeatures(Base):
    """Processed accelerometer/gyroscope feature windows from Android SensorManager.
    The APK computes statistical features locally — raw sensor events are NOT uploaded.
    """
    __tablename__ = "mobile_sensor_features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    device_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    sensor_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "accelerometer" | "gyroscope"
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_size_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Statistical features computed on-device
    mean_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    mean_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    mean_z: Mapped[float | None] = mapped_column(Float, nullable=True)
    std_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    std_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    std_z: Mapped[float | None] = mapped_column(Float, nullable=True)
    magnitude_mean: Mapped[float | None] = mapped_column(Float, nullable=True)
    magnitude_std: Mapped[float | None] = mapped_column(Float, nullable=True)
    movement_intensity: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0.0–1.0

    # Idempotency
    source_record_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    data_source: Mapped[str] = mapped_column(String(50), default="android_sensor", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "source_record_id", name="uq_features_user_source_record"),
        Index("ix_features_user_window", "user_id", "window_start"),
    )
