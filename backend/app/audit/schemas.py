from datetime import datetime
from pydantic import BaseModel


class AuditLogEntry(BaseModel):
    id: int
    recorded_at: datetime
    user_email: str | None
    action: str
    resource: str | None
    detail: str | None
    ip: str | None

    model_config = {"from_attributes": True}


class AuditLogList(BaseModel):
    entries: list[AuditLogEntry]
    total: int
