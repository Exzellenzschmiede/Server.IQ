from pydantic import BaseModel


class SshLogEntry(BaseModel):
    timestamp: str
    user: str | None
    source_ip: str | None
    event: str  # "accepted", "failed", "invalid", "disconnect", "other"
    raw: str


class NginxLogEntry(BaseModel):
    timestamp: str
    source_ip: str
    method: str
    path: str
    status: int
    bytes_sent: int
    user_agent: str


class AccessLogResponse(BaseModel):
    ssh: list[SshLogEntry]
    nginx: list[NginxLogEntry]
