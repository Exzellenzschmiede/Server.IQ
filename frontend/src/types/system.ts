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

export interface DiskIO {
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
}

export interface NetworkInterface {
  name: string;
  bytes_sent: number;
  bytes_recv: number;
  bytes_sent_per_sec: number;
  bytes_recv_per_sec: number;
}

export interface LoadAverage {
  load_1: number;
  load_5: number;
  load_15: number;
}

export interface SystemMetrics {
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskPartition[];
  network: NetworkInterface[];
  disk_io: DiskIO | null;
  load_avg: LoadAverage;
  tcp_connections: number;
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

export interface ServiceActionResponse {
  success: boolean;
  action: string;
  service: string;
  message: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  memory_bytes: number;
  status: string;
  username: string;
}

export interface ServiceDetail {
  key: string;
  description: string;
  active_state: string;
  sub_state: string;
  load_state: string;
  unit_file_state: string;
  main_pid: number | null;
  active_since: string | null;
  memory_bytes: number | null;
  cpu_usage_ms: number | null;
  fragment_path: string | null;
}

export interface ServiceLogs {
  key: string;
  lines: string[];
}

export type HealthStatus = "ok" | "warning" | "critical";

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  value: string;
  detail: string;
}

export interface HealthReport {
  overall: HealthStatus;
  checks: HealthCheck[];
  updates_available: number | null;
}

export interface MetricHistoryPoint {
  timestamp: number;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  disk_read_bps: number;
  disk_write_bps: number;
  net_recv_bps: number;
  net_sent_bps: number;
}
