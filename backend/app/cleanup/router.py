from fastapi import APIRouter, Depends

from app.dependencies import require_admin
from app.models import User

from .schemas import CleanupRequest, CleanupResult, CleanupScanResult
from .service import run_cleanup, scan

router = APIRouter()


@router.get("/scan", response_model=CleanupScanResult)
async def scan_disk(_: User = Depends(require_admin)):
    return scan()


@router.post("/run", response_model=CleanupResult)
async def run(_: User = Depends(require_admin), body: CleanupRequest = ...):
    return run_cleanup(body.actions)
