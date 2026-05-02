import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import require_admin
from app.models import User

from .schemas import SSLResult, VHostConfigUpdate, VHostCreate, VHostOut
from .service import (
    create_vhost,
    delete_vhost,
    enable_ssl,
    get_vhost_config,
    list_vhosts,
    toggle_vhost,
    update_vhost_config,
)

router = APIRouter()


@router.get("", response_model=list[VHostOut])
async def get_vhosts(_: User = Depends(require_admin)):
    return await asyncio.to_thread(list_vhosts)


@router.post("", response_model=VHostOut, status_code=status.HTTP_201_CREATED)
async def add_vhost(body: VHostCreate, _: User = Depends(require_admin)):
    try:
        return await asyncio.to_thread(
            create_vhost, body.domain, body.root_path, body.vhost_type, body.php_version, body.proxy_pass
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{domain}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_vhost(domain: str, _: User = Depends(require_admin)):
    await asyncio.to_thread(delete_vhost, domain)


@router.patch("/{domain}/toggle")
async def toggle(domain: str, enabled: bool, _: User = Depends(require_admin)):
    try:
        await asyncio.to_thread(toggle_vhost, domain, enabled)
        return {"enabled": enabled}
    except RuntimeError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{domain}/config")
async def get_config(domain: str, _: User = Depends(require_admin)):
    try:
        content = await asyncio.to_thread(get_vhost_config, domain)
        return {"config": content}
    except FileNotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{domain}/config")
async def update_config(domain: str, body: VHostConfigUpdate, _: User = Depends(require_admin)):
    try:
        await asyncio.to_thread(update_vhost_config, domain, body.config)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{domain}/ssl", response_model=SSLResult)
async def request_ssl(domain: str, _: User = Depends(require_admin)):
    success, output = await asyncio.to_thread(enable_ssl, domain)
    return SSLResult(success=success, output=output)
