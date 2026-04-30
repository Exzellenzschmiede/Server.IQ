import client from "./client";
import type {
  MetricHistoryPoint,
  ProcessInfo,
  ServiceActionResponse,
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

export async function serviceAction(
  key: string,
  action: "start" | "stop" | "restart",
): Promise<ServiceActionResponse> {
  const { data } = await client.post<ServiceActionResponse>(`/system/services/${key}/action`, { action });
  return data;
}
