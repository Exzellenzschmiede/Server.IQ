from pydantic import BaseModel


class CleanableItem(BaseModel):
    key: str
    label: str
    description: str
    size_bytes: int
    count: int = 0
    available: bool = True


class CleanupScanResult(BaseModel):
    items: list[CleanableItem]
    total_bytes: int


class CleanupRequest(BaseModel):
    actions: list[str]


class CleanupActionResult(BaseModel):
    key: str
    ok: bool
    freed_bytes: int
    message: str


class CleanupResult(BaseModel):
    results: list[CleanupActionResult]
    total_freed_bytes: int
