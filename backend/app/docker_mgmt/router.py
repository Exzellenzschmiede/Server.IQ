from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status

from app.auth.service import decode_token
from app.dependencies import get_current_user
from app.docker_mgmt.schemas import (
    ContainerActionResponse,
    ContainerInfo,
    ContainerStats,
    ContainersResponse,
    ImageInfo,
    ReinstallResponse,
)
from app.docker_mgmt.service import (
    get_container,
    get_container_stats,
    list_containers,
    list_images,
    reinstall_container,
    remove_container,
    restart_container,
    start_container,
    stop_container,
    stream_logs,
)
from app.models import User
from app.websockets.manager import stream_to_websocket

router = APIRouter()


@router.get("/containers", response_model=ContainersResponse)
async def get_containers(
    all: bool = Query(True),
    _: User = Depends(get_current_user),
):
    return await list_containers(all_containers=all)


@router.get("/containers/{container_id}", response_model=ContainerInfo)
async def get_container_detail(
    container_id: str,
    _: User = Depends(get_current_user),
):
    return await get_container(container_id)


@router.post("/containers/{container_id}/start", response_model=ContainerActionResponse)
async def start(container_id: str, _: User = Depends(get_current_user)):
    return await start_container(container_id)


@router.post("/containers/{container_id}/stop", response_model=ContainerActionResponse)
async def stop(container_id: str, _: User = Depends(get_current_user)):
    return await stop_container(container_id)


@router.delete("/containers/{container_id}", response_model=ContainerActionResponse)
async def remove(
    container_id: str,
    force: bool = Query(False),
    _: User = Depends(get_current_user),
):
    return await remove_container(container_id, force=force)


@router.post("/containers/{container_id}/restart", response_model=ContainerActionResponse)
async def restart(container_id: str, _: User = Depends(get_current_user)):
    return await restart_container(container_id)


@router.post("/containers/{container_id}/reinstall", response_model=ReinstallResponse)
async def reinstall(container_id: str, _: User = Depends(get_current_user)):
    return await reinstall_container(container_id)


@router.get("/containers/{container_id}/stats", response_model=ContainerStats)
async def container_stats(container_id: str, _: User = Depends(get_current_user)):
    return await get_container_stats(container_id)


@router.get("/images", response_model=list[ImageInfo])
async def images(_: User = Depends(get_current_user)):
    return await list_images()


@router.websocket("/logs/{container_id}")
async def logs_ws(container_id: str, ws: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    try:
        gen = stream_logs(container_id)
        await stream_to_websocket(ws, gen)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
