import asyncio

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, require_admin
from app.models import User

from .schemas import CertInfo, RenewResponse
from .service import get_certs, renew_cert

router = APIRouter()


@router.get("", response_model=list[CertInfo])
async def ssl_certs(_: User = Depends(get_current_user)):
    return get_certs()


@router.post("/{domain}/renew", response_model=RenewResponse)
async def renew(domain: str, _: User = Depends(require_admin)):
    return await asyncio.to_thread(renew_cert, domain)
