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
    DiskIO,
    DiskPartition,
    HealthCheck,
    HealthReport,
    LoadAverage,
    MemoryMetrics,
    MetricHistoryPoint,
    NetworkInterface,
    ProcessInfo,
    ServiceDetail,
    ServiceLogs,
    ServiceStatus,
    SystemInfo,
    SystemMetrics,
)

# ── Rate tracking ──────────────────────────────────────────────────────────────
_prev_net: dict = {}
_prev_net_time: float = 0.0
_prev_disk_io: object = None
_prev_disk_io_time: float = 0.0

# Fallback used when the DB table is empty
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


def get_disk_io_metrics() -> DiskIO | None:
    global _prev_disk_io, _prev_disk_io_time
    now = time.time()
    try:
        current = psutil.disk_io_counters()
        if not current:
            return None
        elapsed = now - _prev_disk_io_time if _prev_disk_io_time else 1.0
        if _prev_disk_io:
            read_rate = (current.read_bytes - _prev_disk_io.read_bytes) / elapsed
            write_rate = (current.write_bytes - _prev_disk_io.write_bytes) / elapsed
        else:
            read_rate = 0.0
            write_rate = 0.0
        _prev_disk_io = current
        _prev_disk_io_time = now
        return DiskIO(
            read_bytes_per_sec=max(0.0, read_rate),
            write_bytes_per_sec=max(0.0, write_rate),
        )
    except Exception:
        return None


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


def get_load_average() -> LoadAverage:
    try:
        l1, l5, l15 = psutil.getloadavg()
    except AttributeError:
        l1 = l5 = l15 = 0.0
    return LoadAverage(load_1=round(l1, 2), load_5=round(l5, 2), load_15=round(l15, 2))


def get_tcp_connections() -> int:
    try:
        return len(psutil.net_connections(kind="tcp"))
    except Exception:
        return 0


def get_top_processes(sort_by: str = "cpu", limit: int = 5) -> list[ProcessInfo]:
    procs: list[ProcessInfo] = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent", "memory_info", "status", "username"]):
        try:
            i = p.info
            procs.append(ProcessInfo(
                pid=i["pid"],
                name=i["name"] or "",
                cpu_percent=round(i.get("cpu_percent") or 0.0, 1),
                memory_percent=round(i.get("memory_percent") or 0.0, 1),
                memory_bytes=(i.get("memory_info") or type("_", (), {"rss": 0})()).rss,
                status=i.get("status") or "",
                username=i.get("username") or "",
            ))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    key_attr = "cpu_percent" if sort_by == "cpu" else "memory_percent"
    procs.sort(key=lambda p: getattr(p, key_attr), reverse=True)
    return procs[:limit]


def _check_tcp(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def _check_docker_socket() -> bool:
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
            capture_output=True, text=True, timeout=30,
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


async def get_metrics_history(db: AsyncSession, hours: int = 2) -> list[MetricHistoryPoint]:
    from datetime import datetime, timedelta, timezone
    from app.models import MetricSnapshot
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(MetricSnapshot)
        .where(MetricSnapshot.recorded_at >= cutoff)
        .order_by(MetricSnapshot.recorded_at)
    )
    rows = result.scalars().all()
    return [
        MetricHistoryPoint(
            timestamp=row.recorded_at.timestamp(),
            cpu_percent=row.cpu_percent,
            memory_percent=row.memory_percent,
            disk_percent=row.disk_percent,
            disk_read_bps=row.disk_read_bps,
            disk_write_bps=row.disk_write_bps,
            net_recv_bps=row.net_recv_bps,
            net_sent_bps=row.net_sent_bps,
        )
        for row in rows
    ]


def get_all_metrics() -> SystemMetrics:
    return SystemMetrics(
        cpu=get_cpu_metrics(),
        memory=get_memory_metrics(),
        disk=get_disk_metrics(),
        network=get_network_metrics(),
        disk_io=get_disk_io_metrics(),
        load_avg=get_load_average(),
        tcp_connections=get_tcp_connections(),
        timestamp=time.time(),
    )


def get_service_detail(key: str) -> ServiceDetail:
    if not _SERVICE_KEY_RE.match(key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid service key")
    try:
        r = subprocess.run(
            ["systemctl", "show", key, "--no-pager"],
            capture_output=True, text=True, timeout=10,
        )
        props: dict[str, str] = {}
        for line in r.stdout.splitlines():
            if "=" in line:
                k, _, v = line.partition("=")
                props[k.strip()] = v.strip()

        def _int(val: str) -> int | None:
            try:
                n = int(val)
                return n if n >= 0 else None
            except (ValueError, TypeError):
                return None

        mem = _int(props.get("MemoryCurrent", ""))
        cpu_ns = _int(props.get("CPUUsageNSec", ""))
        pid = _int(props.get("MainPID", ""))
        since_raw = props.get("ActiveEnterTimestamp", "")
        since = since_raw if since_raw and since_raw != "n/a" else None

        return ServiceDetail(
            key=key,
            description=props.get("Description", ""),
            active_state=props.get("ActiveState", "unknown"),
            sub_state=props.get("SubState", ""),
            load_state=props.get("LoadState", ""),
            unit_file_state=props.get("UnitFileState", ""),
            main_pid=pid if pid else None,
            active_since=since,
            memory_bytes=mem if mem and mem < 2**63 else None,
            cpu_usage_ms=cpu_ns // 1_000_000 if cpu_ns else None,
            fragment_path=props.get("FragmentPath") or None,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Command timed out")


def get_service_logs(key: str, lines: int = 100) -> ServiceLogs:
    if not _SERVICE_KEY_RE.match(key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid service key")
    try:
        r = subprocess.run(
            ["journalctl", "-u", key, "-n", str(min(lines, 500)),
             "--no-pager", "--output=short-precise"],
            capture_output=True, text=True, timeout=15,
        )
        log_lines = [l for l in r.stdout.splitlines() if l.strip()]
        return ServiceLogs(key=key, lines=log_lines)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Command timed out")


def _apt_updates() -> int | None:
    try:
        r = subprocess.run(
            ["apt", "list", "--upgradable"],
            capture_output=True, text=True, timeout=15,
        )
        count = sum(1 for l in r.stdout.splitlines() if "/" in l and "upgradable" not in l.lower())
        return count
    except Exception:
        return None


def get_health() -> HealthReport:
    checks: list[HealthCheck] = []

    # Disk
    for part in get_disk_metrics():
        if part.percent >= 90:
            s = "critical"
        elif part.percent >= 80:
            s = "warning"
        else:
            s = "ok"
        checks.append(HealthCheck(
            name=f"Disk {part.mountpoint}",
            status=s,
            value=f"{part.percent:.1f}%",
            detail=f"{_fmt_bytes(part.free_bytes)} free of {_fmt_bytes(part.total_bytes)}",
        ))

    # Memory
    mem = get_memory_metrics()
    if mem.percent >= 90:
        ms = "critical"
    elif mem.percent >= 80:
        ms = "warning"
    else:
        ms = "ok"
    checks.append(HealthCheck(
        name="Memory",
        status=ms,
        value=f"{mem.percent:.1f}%",
        detail=f"{_fmt_bytes(mem.used_bytes)} / {_fmt_bytes(mem.total_bytes)}",
    ))

    # Load average
    load = get_load_average()
    cpu_count = psutil.cpu_count(logical=True) or 1
    if load.load_1 >= cpu_count * 2:
        ls = "critical"
    elif load.load_1 >= cpu_count:
        ls = "warning"
    else:
        ls = "ok"
    checks.append(HealthCheck(
        name="CPU Load (1 min)",
        status=ls,
        value=str(load.load_1),
        detail=f"{cpu_count} CPU cores",
    ))

    # Updates
    updates = _apt_updates()
    if updates is not None:
        if updates >= 50:
            us = "critical"
        elif updates > 0:
            us = "warning"
        else:
            us = "ok"
        checks.append(HealthCheck(
            name="System Updates",
            status=us,
            value=f"{updates} pending" if updates > 0 else "Up to date",
            detail="apt upgradable packages",
        ))

    # Overall
    if any(c.status == "critical" for c in checks):
        overall = "critical"
    elif any(c.status == "warning" for c in checks):
        overall = "warning"
    else:
        overall = "ok"

    return HealthReport(overall=overall, checks=checks, updates_available=updates)


def _fmt_bytes(b: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if b < 1024:
            return f"{b:.1f} {unit}"
        b //= 1024
    return f"{b} PB"


def get_open_ports() -> list:
    import socket as _socket
    from app.system.schemas import PortInfo
    result = []
    seen: set = set()
    try:
        connections = psutil.net_connections(kind="inet")
    except psutil.AccessDenied:
        return []
    for conn in connections:
        laddr = conn.laddr
        if not laddr:
            continue
        key = (conn.type, laddr.ip, laddr.port, conn.status or "")
        if key in seen:
            continue
        seen.add(key)
        proc_name = None
        if conn.pid:
            try:
                proc_name = psutil.Process(conn.pid).name()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        proto = "tcp" if conn.type == _socket.SOCK_STREAM else "udp"
        result.append(PortInfo(
            protocol=proto,
            local_address=laddr.ip,
            local_port=laddr.port,
            state=conn.status or "",
            pid=conn.pid,
            process_name=proc_name,
        ))
    result.sort(key=lambda p: p.local_port)
    return result


def kill_process(pid: int):
    from app.system.schemas import KillProcessResponse
    try:
        proc = psutil.Process(pid)
        name = proc.name()
        proc.kill()
        return KillProcessResponse(success=True, pid=pid, message=f"Process '{name}' (PID {pid}) killed")
    except psutil.NoSuchProcess:
        return KillProcessResponse(success=False, pid=pid, message=f"Process {pid} not found")
    except psutil.AccessDenied:
        return KillProcessResponse(success=False, pid=pid, message=f"Permission denied for PID {pid}")


def renice_process(pid: int, nice: int):
    from app.system.schemas import KillProcessResponse
    if not (-20 <= nice <= 19):
        return KillProcessResponse(success=False, pid=pid, message="Nice value must be between -20 and 19")
    try:
        proc = psutil.Process(pid)
        name = proc.name()
        proc.nice(nice)
        return KillProcessResponse(success=True, pid=pid, message=f"Process '{name}' (PID {pid}) reniced to {nice}")
    except psutil.NoSuchProcess:
        return KillProcessResponse(success=False, pid=pid, message=f"Process {pid} not found")
    except psutil.AccessDenied:
        return KillProcessResponse(success=False, pid=pid, message=f"Permission denied for PID {pid}")


def system_power_action(action: str):
    from app.system.schemas import PowerActionResponse
    if action not in ("reboot", "shutdown"):
        return PowerActionResponse(success=False, action=action, message="Invalid action")
    try:
        cmd = ["reboot"] if action == "reboot" else ["poweroff"]
        subprocess.Popen(cmd)
        return PowerActionResponse(success=True, action=action, message=f"System {action} initiated")
    except Exception as exc:
        return PowerActionResponse(success=False, action=action, message=str(exc))
