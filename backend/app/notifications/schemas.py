from pydantic import BaseModel


class NotificationConfigRead(BaseModel):
    telegram_enabled: bool
    telegram_bot_token: str | None
    telegram_chat_id: str | None
    email_enabled: bool
    email_smtp_host: str | None
    email_smtp_port: int
    email_smtp_user: str | None
    email_smtp_password: str | None
    email_from: str | None
    email_to: str | None
    check_interval_minutes: int
    notify_on_failure: bool
    notify_on_recovery: bool


class NotificationConfigUpdate(BaseModel):
    telegram_enabled: bool | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    email_enabled: bool | None = None
    email_smtp_host: str | None = None
    email_smtp_port: int | None = None
    email_smtp_user: str | None = None
    email_smtp_password: str | None = None
    email_from: str | None = None
    email_to: str | None = None
    check_interval_minutes: int | None = None
    notify_on_failure: bool | None = None
    notify_on_recovery: bool | None = None


class TestNotificationRequest(BaseModel):
    channel: str  # "telegram" or "email"
