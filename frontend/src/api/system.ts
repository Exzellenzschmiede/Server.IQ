import client from "./client";
import type { ServicesResponse, SystemInfo, SystemMetrics } from "../types/system";

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
