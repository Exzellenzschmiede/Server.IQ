from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, require_admin
from app.models import User

from .schemas import AddCronRequest, CronJob, CronListResponse
from .service import add_job, delete_job, list_jobs

router = APIRouter()


@router.get("", response_model=CronListResponse)
async def get_cron_jobs(_: User = Depends(get_current_user)):
    return list_jobs()


@router.post("", response_model=CronJob)
async def add_cron_job(body: AddCronRequest, _: User = Depends(require_admin)):
    return add_job(body.schedule, body.command)


@router.delete("/{index}")
async def delete_cron_job(index: int, _: User = Depends(require_admin)):
    return delete_job(index)
