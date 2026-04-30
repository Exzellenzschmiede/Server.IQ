from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import MonitoredService, User
from app.settings.schemas import ServiceConfigCreate, ServiceConfigOut, ServiceConfigUpdate

router = APIRouter()


@router.get("/services", response_model=list[ServiceConfigOut])
async def list_services(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MonitoredService).order_by(MonitoredService.id))
    return result.scalars().all()


@router.post("/services", response_model=ServiceConfigOut, status_code=status.HTTP_201_CREATED)
async def create_service(
    body: ServiceConfigCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.scalar(select(MonitoredService).where(MonitoredService.key == body.key))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Key already exists")
    svc = MonitoredService(**body.model_dump())
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return svc


@router.put("/services/{service_id}", response_model=ServiceConfigOut)
async def update_service(
    service_id: int,
    body: ServiceConfigUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    svc = await db.get(MonitoredService, service_id)
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(svc, field, value)
    await db.commit()
    await db.refresh(svc)
    return svc


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    svc = await db.get(MonitoredService, service_id)
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    await db.delete(svc)
    await db.commit()
