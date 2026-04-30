from typing import AsyncGenerator

from fastapi import WebSocket


async def stream_to_websocket(ws: WebSocket, generator: AsyncGenerator[str, None]) -> None:
    async for line in generator:
        await ws.send_text(line)
