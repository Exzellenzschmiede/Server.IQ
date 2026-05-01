from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.bandwidth.schemas import BandwidthResponse
from app.bandwidth.service import get_bandwidth
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter()


@router.get("/", response_model=BandwidthResponse)
async def bandwidth(
    days: int = Query(30, ge=1, le=90),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_bandwidth(db, days=days)
