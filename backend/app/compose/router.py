from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.compose.schemas import ComposeActionResponse, ComposeProject
from app.compose.service import _run_compose_action, list_compose_projects
from app.dependencies import get_current_user, require_admin
from app.models import User

router = APIRouter()


@router.get("/", response_model=list[ComposeProject])
async def list_projects(_: User = Depends(get_current_user)):
    return list_compose_projects()


class ComposeAction(BaseModel):
    file: str
    action: str


@router.post("/action", response_model=ComposeActionResponse)
async def compose_action(body: ComposeAction, _: User = Depends(require_admin)):
    return _run_compose_action(body.file, body.action)
