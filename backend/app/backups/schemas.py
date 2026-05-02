from datetime import datetime

from pydantic import BaseModel


class BackupCreate(BaseModel):
    name: str
    include_paths: list[str]
    db_connection_id: int | None = None
    db_name: str | None = None   # None = all databases


class BackupOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    completed_at: datetime | None
    size_bytes: int
    backup_path: str
    backup_type: str
    status: str
    error: str | None

    model_config = {"from_attributes": True}
