from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, require_admin
from app.fail2ban.schemas import Fail2banStatus, UnbanRequest, UnbanResponse
from app.fail2ban.service import get_fail2ban_status, unban_ip
from app.models import User

router = APIRouter()


@router.get("/", response_model=Fail2banStatus)
async def status(_: User = Depends(get_current_user)):
    return get_fail2ban_status()


@router.post("/unban", response_model=UnbanResponse)
async def unban(body: UnbanRequest, _: User = Depends(require_admin)):
    return unban_ip(body.jail, body.ip)
