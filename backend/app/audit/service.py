from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import AuditLog


async def log_action(
    action: str,
    user_email: str | None = None,
    resource: str | None = None,
    detail: str | None = None,
    ip: str | None = None,
) -> None:
    """Fire-and-forget audit log write. Never raises."""
    try:
        async with AsyncSessionLocal() as db:
            db.add(AuditLog(
                user_email=user_email,
                action=action,
                resource=resource,
                detail=detail,
                ip=ip,
            ))
            await db.commit()
    except Exception:
        pass
