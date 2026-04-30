import platform
import re
import socket
import subprocess
import time

import psutil
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.system.schemas import (
    CpuMetrics,
    DiskPartition,
    MemoryMetrics,
    NetworkInterface,
    ServiceStatus,
    SystemInfo,
    SystemMetrics,
)

# Track previous network counters for rate calculation
_prev_net: dict = {}
_prev_net_time: float = 0.0

# Fallback used when the DB table is empty (bare-metal: use localhost)
_DEFAULT_SERVICES = [
    ("nginx",      "NGINX",      "127.0.0.1", 80),
    ("postgresql", "PostgreSQL", "127.0.0.1", 5432),
    ("ssh",        "SSH",        "127.0.0.1", 22),
    ("docker",     "Docker",     None,         None),
]


def get_cpu_metrics() -> CpuMetrics:
    freq = psutil.cpu_freq()
    return CpuMetrics(
        percent=psutil.cpu_percent(interval=0.2),
        per_core=psutil.cpu_percent(interval=0, percpu=True),
        count=psutil.cpu_count(logical=False) or 1,
        count_logical=psutil.cpu_count(logical=True) or 1,
        frequency_mhz=freq.current if freq else None,
    )


def get_memory_metrics() -> MemoryMetrics:
    mem = psutil.virtual_memory()
    return MemoryMetrics(
        total_bytes=mem.total,
        available_bytes=mem.available,
        used_bytes=mem.used,
        percent=mem.percent,
    )


def get_disk_metrics() -> list[DiskPartition]:
    partitions = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            partitions.append(
                DiskPartition(
                    mountpoint=part.mountpoint,
                    total_bytes=usage.total,
                    used_bytes=usage.used,
                    free_bytes=usage.free,
                    percent=usage.percent,
                    fstype=part.fstype,
                )
            )
        except (PermissionError, OSError):
            continue
    return partitions


def get_network_metrics() -> list[NetworkInterface]:
    global _prev_net, _prev_net_time

    now = time.time()
    current = psutil.net_io_counters(pernic=True)
    elapsed = now - _prev_net_time if _prev_net_time else 1.0

    result = []
    for name, counters in current.items():
        if name == "lo":
            continue
        prev = _prev_net.get(name)
        sent_rate = (counters.bytes_sent - prev.bytes_sent) / elapsed if prev else 0.0
        recv_rate = (counters.bytes_recv - prev.bytes_recv) / elapsed if prev else 0.0
        result.append(
            NetworkInterface(
                name=name,
                bytes_sent=counters.bytes_sent,
                bytes_recv=counters.bytes_recv,
                bytes_sent_per_sec=max(0.0, sent_rate),
                bytes_recv_per_sec=max(0.0, recv_rate),
            )
        )

    _prev_net = {n: c for n, c in current.items()}
    _prev_net_time = now
    return result


def _check_tcp(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def _check_docker_socket() -> bool:
    """Ping Docker via raw HTTP over the Unix socket — no library needed."""
    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(2.0)
        sock.connect("/var/run/docker.sock")
        sock.sendall(b"GET /_ping HTTP/1.0\r\nHost: localhost\r\n\r\n")
        response = sock.recv(256)
        sock.close()
        return b"200 OK" in response
    except Exception:
        return False


def _check_service(key: str, host: str | None, port: int | None) -> str:
    if key == "docker":
        return "active" if _check_docker_socket() else "failed"
    if host and port:
        return "active" if _check_tcp(host, port) else "inactive"
    return "unknown"


async def get_services(db: AsyncSession) -> list[ServiceStatus]:
    from app.models import MonitoredService
    result = await db.execute(
        select(MonitoredService)
        .where(MonitoredService.enabled == True)
        .order_by(MonitoredService.id)
    )
    rows = result.scalars().all()
    services = [(s.key, s.display_name, s.host, s.port) for s in rows] or _DEFAULT_SERVICES
    return [
        ServiceStatus(name=key, display_name=display, status=_check_service(key, host, port))
        for key, display, host, port in services
    ]


def get_system_info() -> SystemInfo:
    boot = psutil.boot_time()
    return SystemInfo(
        hostname=platform.node(),
        os_name=f"{platform.system()} {platform.release()}",
        kernel_version=platform.version(),
        uptime_seconds=time.time() - boot,
        boot_time=boot,
    )


_SERVICE_KEY_RE = re.compile(r"^[a-zA-Z0-9._@-]{1,64}$")


async def service_action(key: str, action: str, db: AsyncSession) -> dict:
    from app.models import MonitoredService

    if not _SERVICE_KEY_RE.match(key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid service key format")

    svc = await db.scalar(select(MonitoredService).where(MonitoredService.key == key))
    if svc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not in monitored list")

    try:
        result = subprocess.run(
            ["sudo", "systemctl", action, key],
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = (result.stdout + result.stderr).strip()
        return {
            "success": result.returncode == 0,
            "action": action,
            "service": key,
            "message": output or ("OK" if result.returncode == 0 else f"Exit code {result.returncode}"),
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Command timed out")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def get_all_metrics() -> SystemMetrics:
    return SystemMetrics(
        cpu=get_cpu_metrics(),
        memory=get_memory_metrics(),
        disk=get_disk_metrics(),
        network=get_network_metrics(),
        timestamp=time.time(),
    )
