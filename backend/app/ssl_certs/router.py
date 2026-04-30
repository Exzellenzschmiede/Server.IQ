from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models import User

from .schemas import CertInfo
from .service import get_certs

router = APIRouter()


@router.get("", response_model=list[CertInfo])
async def ssl_certs(_: User = Depends(get_current_user)):
    return get_certs()
