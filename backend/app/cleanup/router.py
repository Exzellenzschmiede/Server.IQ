from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from app.dependencies import require_admin
from app.models import User

from .schemas import CleanupRequest, CleanupResult, CleanupScanResult
from .service import run_cleanup, scan

router = APIRouter()


@router.get("/scan", response_model=CleanupScanResult)
async def scan_disk(_: User = Depends(require_admin)):
    return await run_in_threadpool(scan)


@router.post("/run", response_model=CleanupResult)
async def run(_: User = Depends(require_admin), body: CleanupRequest = ...):
    return await run_in_threadpool(run_cleanup, body.actions)
