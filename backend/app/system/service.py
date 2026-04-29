import platform
import subprocess
import time
from typing import Literal

import psutil

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

MONITORED_SERVICES = [
    ("nginx", "NGINX"),
    ("postgresql", "PostgreSQL"),
    ("docker", "Docker"),
    ("ssh", "SSH"),
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


def _check_service(name: str) -> Literal["active", "inactive", "failed", "unknown"]:
    try:
        result = subprocess.run(
            ["systemctl", "is-active", name],
            capture_output=True,
            text=True,
            timeout=3,
        )
        state = result.stdout.strip()
        if state == "active":
            return "active"
        if state == "failed":
            return "failed"
        return "inactive"
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return "unknown"


def get_services() -> list[ServiceStatus]:
    return [
        ServiceStatus(name=name, display_name=display, status=_check_service(name))
        for name, display in MONITORED_SERVICES
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


def get_all_metrics() -> SystemMetrics:
    return SystemMetrics(
        cpu=get_cpu_metrics(),
        memory=get_memory_metrics(),
        disk=get_disk_metrics(),
        network=get_network_metrics(),
        timestamp=time.time(),
    )
