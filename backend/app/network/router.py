import asyncio
import re
import subprocess

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models import User

router = APIRouter()


def _run(cmd: list[str], timeout: int = 10) -> tuple[bool, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        output = (r.stdout + r.stderr).strip()
        return r.returncode == 0, output
    except subprocess.TimeoutExpired:
        return False, "Timed out"
    except FileNotFoundError:
        return False, f"Command not found: {cmd[0]}"


class PingRequest(BaseModel):
    host: str
    count: int = 4


class PingResponse(BaseModel):
    ok: bool
    host: str
    output: str
    avg_ms: float | None = None


class DnsRequest(BaseModel):
    host: str
    record_type: str = "A"


class DnsResponse(BaseModel):
    ok: bool
    host: str
    record_type: str
    output: str


class PortCheckRequest(BaseModel):
    host: str
    port: int


class PortCheckResponse(BaseModel):
    ok: bool
    host: str
    port: int
    open: bool
    output: str


def _validate_host(host: str) -> str:
    host = host.strip()
    if not host or len(host) > 253:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid host")
    if not re.match(r'^[a-zA-Z0-9.\-_]+$', host):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid host characters")
    return host


@router.post("/ping", response_model=PingResponse)
async def ping(body: PingRequest, _: User = Depends(get_current_user)):
    host = _validate_host(body.host)
    count = max(1, min(body.count, 10))
    ok, output = await asyncio.to_thread(_run, ["ping", "-c", str(count), "-W", "3", host])
    # Extract avg RTT
    avg_ms: float | None = None
    m = re.search(r'rtt min/avg/max.*?=\s*[\d.]+/([\d.]+)/', output)
    if m:
        avg_ms = float(m.group(1))
    return PingResponse(ok=ok, host=host, output=output, avg_ms=avg_ms)


@router.post("/dns", response_model=DnsResponse)
async def dns_lookup(body: DnsRequest, _: User = Depends(get_current_user)):
    host = _validate_host(body.host)
    rtype = body.record_type.upper()
    if rtype not in {"A", "AAAA", "MX", "TXT", "CNAME", "NS", "PTR", "SOA"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Unsupported record type")
    ok, output = await asyncio.to_thread(_run, ["dig", "+short", rtype, host])
    if not output and ok:
        output = "(no records found)"
    return DnsResponse(ok=ok, host=host, record_type=rtype, output=output)


@router.post("/port-check", response_model=PortCheckResponse)
async def port_check(body: PortCheckRequest, _: User = Depends(get_current_user)):
    host = _validate_host(body.host)
    port = body.port
    if not (1 <= port <= 65535):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid port")
    ok, output = await asyncio.to_thread(
        _run, ["nc", "-z", "-w", "3", host, str(port)]
    )
    open_flag = ok
    msg = f"Port {port} on {host} is {'open' if open_flag else 'closed/filtered'}"
    return PortCheckResponse(ok=True, host=host, port=port, open=open_flag, output=msg)
