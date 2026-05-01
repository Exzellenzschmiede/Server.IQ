from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import AlertHistory, User

from .schemas import AlertHistoryEntry, NotificationConfigRead, NotificationConfigUpdate, TestNotificationRequest
from .service import get_config, test_notification, update_config

router = APIRouter()


@router.get("", response_model=NotificationConfigRead)
async def read_config(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await get_config(db)


@router.patch("", response_model=NotificationConfigRead)
async def patch_config(
    body: NotificationConfigUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return await update_config(db, updates)


@router.post("/test")
async def test(
    body: TestNotificationRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await test_notification(db, body.channel)


@router.get("/history", response_model=list[AlertHistoryEntry])
async def alert_history(
    limit: int = Query(100, ge=1, le=500),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AlertHistory)
        .order_by(AlertHistory.recorded_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        AlertHistoryEntry(
            id=r.id,
            recorded_at=r.recorded_at.isoformat(),
            channel=r.channel,
            service_key=r.service_key,
            event=r.event,
            message=r.message,
        )
        for r in rows
    ]
