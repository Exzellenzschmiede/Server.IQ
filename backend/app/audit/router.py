from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import AuditLog, User

from .schemas import AuditLogEntry, AuditLogList

router = APIRouter()


@router.get("", response_model=AuditLogList)
async def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None),
    user_email: str | None = Query(None),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog).order_by(AuditLog.recorded_at.desc())
    if action:
        q = q.where(AuditLog.action.ilike(f"%{action}%"))
    if user_email:
        q = q.where(AuditLog.user_email.ilike(f"%{user_email}%"))

    total_q = select(func.count()).select_from(q.subquery())
    total = await db.scalar(total_q) or 0

    q = q.limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return AuditLogList(entries=list(rows), total=total)


@router.delete("", status_code=204)
async def clear_audit_logs(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(AuditLog.__table__.delete())
    await db.commit()
