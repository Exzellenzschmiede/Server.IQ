from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, require_admin
from app.models import User
from app.updates.schemas import UpdatesResponse, UpgradeResponse
from app.updates.service import get_pending_updates, run_apt_update, run_upgrade

router = APIRouter()


@router.get("/", response_model=UpdatesResponse)
async def list_updates(_: User = Depends(get_current_user)):
    return get_pending_updates()


@router.post("/fetch", response_model=UpgradeResponse)
async def fetch_updates(_: User = Depends(require_admin)):
    return run_apt_update()


@router.post("/upgrade", response_model=UpgradeResponse)
async def upgrade(_: User = Depends(require_admin)):
    return run_upgrade()
