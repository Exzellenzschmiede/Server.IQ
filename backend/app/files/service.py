import os
from pathlib import Path

from fastapi import HTTPException, status

from .schemas import FileContentResponse, FileEntry, FileListResponse

ALLOWED_ROOTS = ["/opt/server-iq", "/var/log"]
MAX_READ_BYTES = 512 * 1024  # 512 KB


def _safe_resolve(path: str) -> Path:
    resolved = Path(os.path.realpath(path))
    for root in ALLOWED_ROOTS:
        try:
            resolved.relative_to(root)
            return resolved
        except ValueError:
            continue
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Path is outside allowed roots: {ALLOWED_ROOTS}",
    )


def list_path(path: str | None) -> FileListResponse:
    if not path:
        entries = []
        for root in ALLOWED_ROOTS:
            p = Path(root)
            if p.exists():
                entries.append(FileEntry(
                    name=root,
                    path=root,
                    is_dir=True,
                    size=0,
                    modified=p.stat().st_mtime if p.exists() else 0,
                ))
        return FileListResponse(path="/", entries=entries, allowed_roots=ALLOWED_ROOTS)

    resolved = _safe_resolve(path)
    if not resolved.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Path not found")
    if not resolved.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is not a directory")

    entries = []
    try:
        for child in sorted(resolved.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            try:
                stat = child.stat()
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

    return FileListResponse(path=str(resolved), entries=entries, allowed_roots=ALLOWED_ROOTS)


def read_file(path: str) -> FileContentResponse:
    resolved = _safe_resolve(path)
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
                detail="File is not valid UTF-8 text",
            )
        return FileContentResponse(path=str(resolved), content=content, truncated=truncated)
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
