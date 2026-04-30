from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models import User

from .schemas import FileContentResponse, FileListResponse
from .service import list_path, read_file

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
