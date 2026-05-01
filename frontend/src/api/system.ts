import client from "./client";
import type {
  HealthReport,
  MetricHistoryPoint,
  ProcessInfo,
  ServiceActionResponse,
  ServiceDetail,
  ServiceLogs,
  ServicesResponse,
  SystemInfo,
  SystemMetrics,
} from "../types/system";

export async function getMetrics(): Promise<SystemMetrics> {
  const { data } = await client.get<SystemMetrics>("/system/metrics");
  return data;
}

export async function getServices(): Promise<ServicesResponse> {
  const { data } = await client.get<ServicesResponse>("/system/services");
  return data;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const { data } = await client.get<SystemInfo>("/system/info");
  return data;
}

export async function getTopProcesses(sortBy: "cpu" | "memory" = "cpu", limit = 10): Promise<ProcessInfo[]> {
  const { data } = await client.get<ProcessInfo[]>(`/system/processes?sort_by=${sortBy}&limit=${limit}`);
  return data;
}

export async function getMetricsHistory(hours = 2): Promise<MetricHistoryPoint[]> {
  const { data } = await client.get<MetricHistoryPoint[]>(`/system/history?hours=${hours}`);
  return data;
}

export async function getServiceDetail(key: string): Promise<ServiceDetail> {
  const { data } = await client.get<ServiceDetail>(`/system/services/${key}/detail`);
  return data;
}

export async function getServiceLogs(key: string, lines = 100): Promise<ServiceLogs> {
  const { data } = await client.get<ServiceLogs>(`/system/services/${key}/logs?lines=${lines}`);
  return data;
}

export async function getHealth(): Promise<HealthReport> {
  const { data } = await client.get<HealthReport>("/system/health");
  return data;
}

export async function serviceAction(
  key: string,
  action: "start" | "stop" | "restart",
): Promise<ServiceActionResponse> {
  const { data } = await client.post<ServiceActionResponse>(`/system/services/${key}/action`, { action });
  return data;
}

export async function getOpenPorts(): Promise<import("../types/system").PortInfo[]> {
  const { data } = await client.get("/system/ports");
  return data;
}

export async function killProcess(pid: number): Promise<{ success: boolean; pid: number; message: string }> {
  const { data } = await client.delete(`/system/processes/${pid}`);
  return data;
}

export async function systemPower(action: "reboot" | "shutdown"): Promise<{ success: boolean; action: string; message: string }> {
  const { data } = await client.post("/system/power", { action });
  return data;
}
