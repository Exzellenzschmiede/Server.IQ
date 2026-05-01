from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status

from app.access_log.schemas import AccessLogResponse
from app.access_log.service import get_access_log, stream_ssh_log
from app.auth.service import decode_token
from app.dependencies import get_current_user
from app.models import User
from app.websockets.manager import stream_to_websocket

router = APIRouter()


@router.get("/", response_model=AccessLogResponse)
async def access_log(
    limit: int = Query(200, ge=10, le=1000),
    _: User = Depends(get_current_user),
):
    return get_access_log(limit=limit)


@router.websocket("/stream")
async def access_log_stream(ws: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    try:
        await stream_to_websocket(ws, stream_ssh_log())
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
