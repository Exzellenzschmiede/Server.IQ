import os
import shutil
from pathlib import Path

from fastapi import HTTPException, status

from .schemas import FileContentResponse, FileEntry, FileListResponse, FileOpResponse, UploadResponse

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


def create_dir(path: str) -> FileOpResponse:
    resolved = _resolve(path)
    if resolved.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path already exists")
    try:
        resolved.mkdir(parents=True, exist_ok=False)
        return FileOpResponse(path=str(resolved))
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def delete_entry(path: str) -> None:
    resolved = _resolve(path)
    if not resolved.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Path not found")
    try:
        if resolved.is_dir():
            shutil.rmtree(resolved)
        else:
            resolved.unlink()
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def copy_entry(src: str, dst: str) -> FileOpResponse:
    src_resolved = _resolve(src)
    dst_resolved = _resolve(dst)
    if not src_resolved.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    if dst_resolved.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Destination already exists")
    try:
        if src_resolved.is_dir():
            shutil.copytree(src_resolved, dst_resolved)
        else:
            dst_resolved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_resolved, dst_resolved)
        return FileOpResponse(path=str(dst_resolved))
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


async def upload_files(dest: str, files: list, relative_paths: list[str]) -> UploadResponse:
    dest_resolved = _resolve(dest)
    if not dest_resolved.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination directory not found")
    if not dest_resolved.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Destination is not a directory")

    uploaded = 0
    for file, rel_path in zip(files, relative_paths):
        clean = Path(rel_path.lstrip("/"))
        if any(part == ".." for part in clean.parts):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid path: {rel_path}")
        target = dest_resolved / clean
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            content = await file.read()
            with open(target, "wb") as f:
                f.write(content)
            uploaded += 1
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
        finally:
            await file.close()

    return UploadResponse(uploaded=uploaded, dest=str(dest_resolved))


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
