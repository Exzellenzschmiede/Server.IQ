import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.admin)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MonitoredService(Base):
    __tablename__ = "monitored_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    host: Mapped[str | None] = mapped_column(String(256), nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MetricSnapshot(Base):
    __tablename__ = "metric_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    cpu_percent: Mapped[float] = mapped_column(Float, nullable=False)
    memory_percent: Mapped[float] = mapped_column(Float, nullable=False)
    disk_percent: Mapped[float] = mapped_column(Float, nullable=False)
    disk_read_bps: Mapped[float] = mapped_column(Float, default=0.0)
    disk_write_bps: Mapped[float] = mapped_column(Float, default=0.0)
    net_recv_bps: Mapped[float] = mapped_column(Float, default=0.0)
    net_sent_bps: Mapped[float] = mapped_column(Float, default=0.0)


class AppConfig(Base):
    __tablename__ = "app_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    upload_max_size_mb: Mapped[int] = mapped_column(Integer, default=100)


class NotificationConfig(Base):
    __tablename__ = "notification_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    telegram_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    telegram_bot_token: Mapped[str | None] = mapped_column(String(256), nullable=True)
    telegram_chat_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    email_smtp_host: Mapped[str | None] = mapped_column(String(256), nullable=True)
    email_smtp_port: Mapped[int] = mapped_column(Integer, default=25)
    email_smtp_user: Mapped[str | None] = mapped_column(String(256), nullable=True)
    email_smtp_password: Mapped[str | None] = mapped_column(String(256), nullable=True)
    email_from: Mapped[str | None] = mapped_column(String(256), nullable=True)
    email_to: Mapped[str | None] = mapped_column(String(256), nullable=True)
    check_interval_minutes: Mapped[int] = mapped_column(Integer, default=5)
    notify_on_failure: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_on_recovery: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ServiceAlertState(Base):
    __tablename__ = "service_alert_states"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    is_down: Mapped[bool] = mapped_column(Boolean, default=False)
    alerted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    service_key: Mapped[str] = mapped_column(String(64), nullable=False)
    event: Mapped[str] = mapped_column(String(16), nullable=False)   # "down" or "recovery"
    message: Mapped[str] = mapped_column(Text, nullable=False)
