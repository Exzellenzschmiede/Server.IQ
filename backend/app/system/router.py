from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models import User
from app.system.schemas import ServicesResponse, SystemInfo, SystemMetrics
from app.system.service import get_all_metrics, get_services, get_system_info

router = APIRouter()


@router.get("/metrics", response_model=SystemMetrics)
async def metrics(_: User = Depends(get_current_user)):
    return get_all_metrics()


@router.get("/services", response_model=ServicesResponse)
async def services(_: User = Depends(get_current_user)):
    return ServicesResponse(services=get_services())


@router.get("/info", response_model=SystemInfo)
async def info(_: User = Depends(get_current_user)):
    return get_system_info()
