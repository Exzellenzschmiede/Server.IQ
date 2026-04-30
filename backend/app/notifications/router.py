from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import User

from .schemas import NotificationConfigRead, NotificationConfigUpdate, TestNotificationRequest
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
