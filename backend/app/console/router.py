import asyncio
import base64
import json

import asyncssh
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.auth.service import decode_token
from app.config import settings

router = APIRouter()


@router.websocket("/ws")
async def console_ws(ws: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()

    if not settings.console_ssh_key_b64:
        await ws.send_bytes(
            b"\r\n\x1b[31mKonsole nicht konfiguriert.\x1b[0m\r\n"
            b"Bitte \x1b[33mCONSOLE_SSH_KEY_B64\x1b[0m in der .env setzen:\r\n"
            b"  base64 -w0 ~/.ssh/id_ed25519\r\n"
        )
        await ws.close()
        return

    try:
        private_key = asyncssh.import_private_key(
            base64.b64decode(settings.console_ssh_key_b64)
        )
        conn = await asyncssh.connect(
            host=settings.console_ssh_host,
            port=settings.console_ssh_port,
            username=settings.console_ssh_user,
            client_keys=[private_key],
            known_hosts=None,
            encoding=None,
        )
    except Exception as exc:
        await ws.send_bytes(f"\r\n\x1b[31mSSH-Verbindungsfehler: {exc}\x1b[0m\r\n".encode())
        await ws.close()
        return

    try:
        process = await conn.create_process(term_type="xterm-256color", term_size=(80, 24))
    except Exception as exc:
        await ws.send_bytes(f"\r\n\x1b[31mShell-Fehler: {exc}\x1b[0m\r\n".encode())
        conn.close()
        await ws.close()
        return

    async def ssh_to_ws() -> None:
        try:
            while True:
                data = await process.stdout.read(4096)
                if not data:
                    break
                await ws.send_bytes(data if isinstance(data, bytes) else data.encode())
        except Exception:
            pass

    async def ws_to_ssh() -> None:
        while True:
            try:
                msg = await ws.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                if msg.get("text"):
                    try:
                        event = json.loads(msg["text"])
                        if event.get("type") == "resize":
                            process.change_terminal_size(
                                int(event.get("cols", 80)),
                                int(event.get("rows", 24)),
                            )
                    except (json.JSONDecodeError, ValueError):
                        pass
                elif msg.get("bytes"):
                    process.stdin.write(msg["bytes"])
            except (WebSocketDisconnect, Exception):
                break

    ssh_task = asyncio.create_task(ssh_to_ws())
    ws_task = asyncio.create_task(ws_to_ssh())

    await asyncio.wait([ssh_task, ws_task], return_when=asyncio.FIRST_COMPLETED)

    ssh_task.cancel()
    ws_task.cancel()

    try:
        process.close()
    except Exception:
        pass
    try:
        conn.close()
    except Exception:
        pass
    try:
        await ws.close()
    except Exception:
        pass
