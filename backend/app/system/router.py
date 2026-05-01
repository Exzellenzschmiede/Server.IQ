from pydantic import BaseModel

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import User
from app.system.schemas import (
    HealthReport,
    KillProcessResponse,
    MetricHistoryPoint,
    PortInfo,
    PowerActionResponse,
    ProcessInfo,
    ServiceActionRequest,
    ServiceActionResponse,
    ServiceDetail,
    ServiceLogs,
    ServicesResponse,
    SystemInfo,
    SystemMetrics,
)
from app.system.service import (
    get_all_metrics,
    get_health,
    get_metrics_history,
    get_open_ports,
    get_service_detail,
    get_service_logs,
    get_services,
    get_system_info,
    get_top_processes,
    kill_process,
    renice_process,
    service_action,
    system_power_action,
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


@router.get("/services/{key}/detail", response_model=ServiceDetail)
async def service_detail(key: str, _: User = Depends(get_current_user)):
    return get_service_detail(key)


@router.get("/services/{key}/logs", response_model=ServiceLogs)
async def service_logs(
    key: str,
    lines: int = Query(100, ge=10, le=500),
    _: User = Depends(get_current_user),
):
    return get_service_logs(key, lines)


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


@router.get("/health", response_model=HealthReport)
async def health(_: User = Depends(get_current_user)):
    return get_health()


@router.post("/services/{key}/action", response_model=ServiceActionResponse)
async def action_service(
    key: str,
    body: ServiceActionRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service_action(key, body.action, db)


@router.get("/ports", response_model=list[PortInfo])
async def open_ports(_: User = Depends(get_current_user)):
    return get_open_ports()


@router.delete("/processes/{pid}", response_model=KillProcessResponse)
async def kill_proc(pid: int, _: User = Depends(require_admin)):
    return kill_process(pid)


class ReniceRequest(BaseModel):
    nice: int


@router.post("/processes/{pid}/renice", response_model=KillProcessResponse)
async def renice_proc(pid: int, body: ReniceRequest, _: User = Depends(require_admin)):
    return renice_process(pid, body.nice)


class PowerRequest(BaseModel):
    action: str


@router.post("/power", response_model=PowerActionResponse)
async def power(body: PowerRequest, _: User = Depends(require_admin)):
    return system_power_action(body.action)
