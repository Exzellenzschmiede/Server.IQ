from pydantic import BaseModel


class FileEntry(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int
    modified: float
    permissions: str = ""   # e.g. "-rwxr-xr-x"
    owner: str = ""


class ChmodRequest(BaseModel):
    path: str
    mode: str   # octal string, e.g. "755"


class FileListResponse(BaseModel):
    path: str
    entries: list[FileEntry]


class FileContentResponse(BaseModel):
    path: str
    content: str
    truncated: bool


class FileWriteRequest(BaseModel):
    path: str
    content: str


class CreateDirRequest(BaseModel):
    path: str


class FileCopyRequest(BaseModel):
    src: str
    dst: str


class FileOpResponse(BaseModel):
    path: str


class UploadResponse(BaseModel):
    uploaded: int
    dest: str
