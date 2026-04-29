from typing import Literal

from pydantic import BaseModel


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


class NetworkInterface(BaseModel):
    name: str
    bytes_sent: int
    bytes_recv: int
    bytes_sent_per_sec: float
    bytes_recv_per_sec: float


class SystemMetrics(BaseModel):
    cpu: CpuMetrics
    memory: MemoryMetrics
    disk: list[DiskPartition]
    network: list[NetworkInterface]
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
