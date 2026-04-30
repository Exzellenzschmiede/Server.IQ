import asyncio
import fcntl
import json
import os
import pty
import struct
import termios

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.auth.service import decode_token

router = APIRouter()


def _read_pty(fd: int) -> bytes | None:
    try:
        return os.read(fd, 4096)
    except OSError:
        return None


def _set_winsize(fd: int, rows: int, cols: int) -> None:
    try:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    except Exception:
        pass


@router.websocket("/ws")
async def console_ws(ws: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()

    master_fd, slave_fd = pty.openpty()
    _set_winsize(slave_fd, 24, 80)

    proc = await asyncio.create_subprocess_exec(
        "/bin/bash",
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        env={**os.environ, "TERM": "xterm-256color", "LANG": "en_US.UTF-8"},
        close_fds=True,
    )
    os.close(slave_fd)

    loop = asyncio.get_event_loop()

    async def pty_to_ws() -> None:
        while True:
            data = await loop.run_in_executor(None, _read_pty, master_fd)
            if data is None:
                break
            try:
                await ws.send_bytes(data)
            except Exception:
                break

    async def ws_to_pty() -> None:
        while True:
            try:
                msg = await ws.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                if msg.get("text"):
                    try:
                        event = json.loads(msg["text"])
                        if event.get("type") == "resize":
                            _set_winsize(
                                master_fd,
                                int(event.get("rows", 24)),
                                int(event.get("cols", 80)),
                            )
                    except (json.JSONDecodeError, ValueError):
                        pass
                elif msg.get("bytes"):
                    os.write(master_fd, msg["bytes"])
            except (WebSocketDisconnect, Exception):
                break

    pty_task = asyncio.create_task(pty_to_ws())
    ws_task = asyncio.create_task(ws_to_pty())

    await asyncio.wait([pty_task, ws_task], return_when=asyncio.FIRST_COMPLETED)

    # Close fd first — unblocks the blocking os.read in the executor thread
    try:
        os.close(master_fd)
    except Exception:
        pass

    pty_task.cancel()
    ws_task.cancel()

    try:
        proc.kill()
        await proc.wait()
    except Exception:
        pass
    try:
        await ws.close()
    except Exception:
        pass
