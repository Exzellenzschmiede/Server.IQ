from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, require_admin
from app.models import User

from .schemas import AddRuleRequest, FirewallStatus
from .service import add_rule, delete_rule, get_status, set_enabled

router = APIRouter()


@router.get("", response_model=FirewallStatus)
async def firewall_status(_: User = Depends(get_current_user)):
    return get_status()


@router.post("/enable")
async def enable_firewall(_: User = Depends(require_admin)):
    return set_enabled(True)


@router.post("/disable")
async def disable_firewall(_: User = Depends(require_admin)):
    return set_enabled(False)


@router.post("/rules")
async def add_firewall_rule(body: AddRuleRequest, _: User = Depends(require_admin)):
    return add_rule(body.port, body.protocol, body.action)


@router.delete("/rules/{num}")
async def delete_firewall_rule(num: int, _: User = Depends(require_admin)):
    return delete_rule(num)
