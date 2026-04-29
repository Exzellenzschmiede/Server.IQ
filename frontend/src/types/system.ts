export interface CpuMetrics {
  percent: number;
  per_core: number[];
  count: number;
  count_logical: number;
  frequency_mhz: number | null;
}

export interface MemoryMetrics {
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  percent: number;
}

export interface DiskPartition {
  mountpoint: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  percent: number;
  fstype: string;
}

export interface NetworkInterface {
  name: string;
  bytes_sent: number;
  bytes_recv: number;
  bytes_sent_per_sec: number;
  bytes_recv_per_sec: number;
}

export interface SystemMetrics {
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskPartition[];
  network: NetworkInterface[];
  timestamp: number;
}

export type ServiceState = "active" | "inactive" | "failed" | "unknown";

export interface ServiceStatus {
  name: string;
  status: ServiceState;
  display_name: string;
}

export interface ServicesResponse {
  services: ServiceStatus[];
}

export interface SystemInfo {
  hostname: string;
  os_name: string;
  kernel_version: string;
  uptime_seconds: number;
  boot_time: number;
}
