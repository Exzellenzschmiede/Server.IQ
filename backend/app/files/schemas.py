from pydantic import BaseModel


class FileEntry(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int
    modified: float


class FileListResponse(BaseModel):
    path: str
    entries: list[FileEntry]
    allowed_roots: list[str]


class FileContentResponse(BaseModel):
    path: str
    content: str
    truncated: bool
