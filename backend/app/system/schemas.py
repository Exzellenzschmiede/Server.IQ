from typing import Literal

from pydantic import BaseModel, Field


class CpuMetrics(BaseModel):
    percent: float
    per_core: list[float]
    count: int
    count_logical: int
    frequency_mhz: float | None


class MemoryMetrics(BaseModel):
    total_bytes: int
    available_bytes: int
    used_bytes: int
    percent: float


class DiskPartition(BaseModel):
    mountpoint: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    percent: float
    fstype: str


class DiskIO(BaseModel):
    read_bytes_per_sec: float
    write_bytes_per_sec: float


class NetworkInterface(BaseModel):
    name: str
    bytes_sent: int
    bytes_recv: int
    bytes_sent_per_sec: float
    bytes_recv_per_sec: float


class LoadAverage(BaseModel):
    load_1: float
    load_5: float
    load_15: float


class SystemMetrics(BaseModel):
    cpu: CpuMetrics
    memory: MemoryMetrics
    disk: list[DiskPartition]
    network: list[NetworkInterface]
    disk_io: DiskIO | None
    load_avg: LoadAverage
    tcp_connections: int
    timestamp: float


class ServiceStatus(BaseModel):
    name: str
    status: Literal["active", "inactive", "failed", "unknown"]
    display_name: str


class ServicesResponse(BaseModel):
    services: list[ServiceStatus]


class SystemInfo(BaseModel):
    hostname: str
    os_name: str
    kernel_version: str
    uptime_seconds: float
    boot_time: float


class ServiceActionRequest(BaseModel):
    action: Literal["start", "stop", "restart"]


class ServiceActionResponse(BaseModel):
    success: bool
    action: str
    service: str
    message: str


class ServiceDetail(BaseModel):
    key: str
    description: str
    active_state: str
    sub_state: str
    load_state: str
    unit_file_state: str
    main_pid: int | None
    active_since: str | None
    memory_bytes: int | None
    cpu_usage_ms: int | None
    fragment_path: str | None


class ServiceLogs(BaseModel):
    key: str
    lines: list[str]


class ProcessInfo(BaseModel):
    pid: int
    name: str
    cpu_percent: float
    memory_percent: float
    memory_bytes: int
    status: str
    username: str


class MetricHistoryPoint(BaseModel):
    timestamp: float
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    disk_read_bps: float
    disk_write_bps: float
    net_recv_bps: float
    net_sent_bps: float


HealthStatus = Literal["ok", "warning", "critical"]


class HealthCheck(BaseModel):
    name: str
    status: HealthStatus
    value: str
    detail: str = ""


class HealthReport(BaseModel):
    overall: HealthStatus
    checks: list[HealthCheck]
    updates_available: int | None = None
