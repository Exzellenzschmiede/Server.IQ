from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user, require_admin
from app.models import User

from .schemas import (
    NginxActionResult,
    NginxConfigResponse,
    NginxSiteList,
    NginxStatus,
    NginxTestResult,
)
from .service import (
    delete_config,
    disable_site,
    enable_site,
    get_status,
    list_sites,
    read_config,
    reload_nginx,
    restart_nginx,
    test_config,
    write_config,
)

router = APIRouter()


class WriteBody(BaseModel):
    name: str
    content: str


@router.get("/status", response_model=NginxStatus)
async def status(_: User = Depends(get_current_user)):
    return get_status()


@router.get("/sites", response_model=NginxSiteList)
async def sites(_: User = Depends(get_current_user)):
    return list_sites()


@router.get("/config", response_model=NginxConfigResponse)
async def config(name: str, _: User = Depends(get_current_user)):
    return read_config(name)


@router.put("/config", response_model=NginxActionResult)
async def save_config(body: WriteBody, _: User = Depends(require_admin)):
    return write_config(body.name, body.content)


@router.delete("/config", response_model=NginxActionResult)
async def del_config(name: str, _: User = Depends(require_admin)):
    return delete_config(name)


@router.post("/sites/{name}/enable", response_model=NginxActionResult)
async def do_enable(name: str, _: User = Depends(require_admin)):
    return enable_site(name)


@router.post("/sites/{name}/disable", response_model=NginxActionResult)
async def do_disable(name: str, _: User = Depends(require_admin)):
    return disable_site(name)


@router.post("/test", response_model=NginxTestResult)
async def test(_: User = Depends(get_current_user)):
    return test_config()


@router.post("/reload", response_model=NginxActionResult)
async def reload(_: User = Depends(require_admin)):
    return reload_nginx()


@router.post("/restart", response_model=NginxActionResult)
async def restart(_: User = Depends(require_admin)):
    return restart_nginx()
