import asyncio
from typing import Generator

from fastapi import WebSocket


async def stream_to_websocket(ws: WebSocket, generator: Generator[str, None, None]) -> None:
    loop = asyncio.get_event_loop()

    def _next():
        try:
            return next(generator)
        except StopIteration:
            return None

    try:
        while True:
            line = await loop.run_in_executor(None, _next)
            if line is None:
                break
            await ws.send_text(line)
    except Exception:
        pass
