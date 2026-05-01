from pydantic import BaseModel


class PendingUpdate(BaseModel):
    package: str
    current_version: str
    new_version: str
    architecture: str


class UpdatesResponse(BaseModel):
    updates: list[PendingUpdate]
    count: int
    apt_available: bool


class UpgradeResponse(BaseModel):
    success: bool
    output: str
