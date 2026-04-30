import os
from pathlib import Path

from fastapi import HTTPException, status

from .schemas import FileContentResponse, FileEntry, FileListResponse

MAX_READ_BYTES = 2 * 1024 * 1024  # 2 MB


def _resolve(path: str) -> Path:
    return Path(os.path.realpath(path))


def list_path(path: str | None) -> FileListResponse:
    resolved = _resolve(path) if path else Path("/")
    if not resolved.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Path not found")
    if not resolved.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is not a directory")

    entries = []
    try:
        children = sorted(resolved.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        for child in children:
            try:
                stat = child.stat(follow_symlinks=False)
                entries.append(FileEntry(
                    name=child.name,
                    path=str(child),
                    is_dir=child.is_dir(),
                    size=stat.st_size,
                    modified=stat.st_mtime,
                ))
            except (PermissionError, OSError):
                continue
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    return FileListResponse(path=str(resolved), entries=entries)


def read_file(path: str) -> FileContentResponse:
    resolved = _resolve(path)
    if not resolved.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if resolved.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is a directory")

    try:
        size = resolved.stat().st_size
        truncated = size > MAX_READ_BYTES
        with open(resolved, "rb") as f:
            raw = f.read(MAX_READ_BYTES)
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="File is not valid UTF-8 / binary file",
            )
        return FileContentResponse(path=str(resolved), content=content, truncated=truncated)
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def write_file(path: str, content: str) -> FileContentResponse:
    resolved = _resolve(path)
    if resolved.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is a directory")

    try:
        resolved.parent.mkdir(parents=True, exist_ok=True)
        with open(resolved, "w", encoding="utf-8") as f:
            f.write(content)
        return FileContentResponse(path=str(resolved), content=content, truncated=False)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
