from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import User
from app.system.schemas import (
    MetricHistoryPoint,
    ProcessInfo,
    ServiceActionRequest,
    ServiceActionResponse,
    ServicesResponse,
    SystemInfo,
    SystemMetrics,
)
from app.system.service import (
    get_all_metrics,
    get_metrics_history,
    get_services,
    get_system_info,
    get_top_processes,
    service_action,
)

router = APIRouter()


@router.get("/metrics", response_model=SystemMetrics)
async def metrics(_: User = Depends(get_current_user)):
    return get_all_metrics()


@router.get("/services", response_model=ServicesResponse)
async def services(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return ServicesResponse(services=await get_services(db))


@router.get("/info", response_model=SystemInfo)
async def info(_: User = Depends(get_current_user)):
    return get_system_info()


@router.get("/processes", response_model=list[ProcessInfo])
async def processes(
    sort_by: str = Query("cpu", pattern="^(cpu|memory)$"),
    limit: int = Query(10, ge=1, le=50),
    _: User = Depends(get_current_user),
):
    return get_top_processes(sort_by=sort_by, limit=limit)


@router.get("/history", response_model=list[MetricHistoryPoint])
async def history(
    hours: int = Query(2, ge=1, le=168),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_metrics_history(db, hours=hours)


@router.post("/services/{key}/action", response_model=ServiceActionResponse)
async def action_service(
    key: str,
    body: ServiceActionRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service_action(key, body.action, db)
