import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.auth.service import decode_token
from app.database import AsyncSessionLocal
from app.models import User, UserRole

router = APIRouter()


@router.websocket("/stream")
async def app_logs_stream(
    ws: WebSocket,
    token: str = Query(...),
    lines: int = Query(300, ge=1, le=2000),
):
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with AsyncSessionLocal() as db:
        user = await db.scalar(
            select(User).where(User.email == payload.get("sub"), User.is_active == True)
        )
        if user is None or user.role != UserRole.admin:
            await ws.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await ws.accept()
    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            "journalctl", "-u", "server-iq", "-f", "--no-pager",
            f"-n{lines}", "--output=short-precise",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        async def _read_proc():
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                await ws.send_text(line.decode("utf-8", errors="replace").rstrip("\n"))

        async def _recv_ws():
            while True:
                try:
                    await ws.receive_text()
                except Exception:
                    break

        read_task = asyncio.create_task(_read_proc())
        recv_task = asyncio.create_task(_recv_ws())
        await asyncio.wait([read_task, recv_task], return_when=asyncio.FIRST_COMPLETED)
        for t in [read_task, recv_task]:
            t.cancel()

    except WebSocketDisconnect:
        pass
    finally:
        if proc and proc.returncode is None:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=2.0)
            except Exception:
                pass
        try:
            await ws.close()
        except Exception:
            pass
