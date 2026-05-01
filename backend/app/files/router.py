from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user, require_admin
from app.models import User

from .schemas import (
    CreateDirRequest,
    FileCopyRequest,
    FileContentResponse,
    FileListResponse,
    FileOpResponse,
    FileWriteRequest,
)
from .service import copy_entry, create_dir, delete_entry, list_path, read_file, write_file

router = APIRouter()


@router.get("", response_model=FileListResponse)
async def browse(
    path: str | None = Query(None),
    _: User = Depends(get_current_user),
):
    return list_path(path)


@router.get("/read", response_model=FileContentResponse)
async def read(
    path: str = Query(...),
    _: User = Depends(get_current_user),
):
    return read_file(path)


@router.post("/write", response_model=FileContentResponse)
async def write(
    body: FileWriteRequest,
    _: User = Depends(require_admin),
):
    return write_file(body.path, body.content)


@router.post("/mkdir", response_model=FileOpResponse)
async def mkdir(
    body: CreateDirRequest,
    _: User = Depends(require_admin),
):
    return create_dir(body.path)


@router.delete("/delete", status_code=204)
async def delete(
    path: str = Query(...),
    _: User = Depends(require_admin),
):
    delete_entry(path)


@router.post("/copy", response_model=FileOpResponse)
async def copy(
    body: FileCopyRequest,
    _: User = Depends(require_admin),
):
    return copy_entry(body.src, body.dst)
