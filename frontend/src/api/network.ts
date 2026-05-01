import client from "./client";

export interface PingResponse {
  ok: boolean;
  host: string;
  output: string;
  avg_ms: number | null;
}

export interface DnsResponse {
  ok: boolean;
  host: string;
  record_type: string;
  output: string;
}

export interface PortCheckResponse {
  ok: boolean;
  host: string;
  port: number;
  open: boolean;
  output: string;
}

export async function pingHost(host: string, count = 4): Promise<PingResponse> {
  const { data } = await client.post<PingResponse>("/network/ping", { host, count });
  return data;
}

export async function dnsLookup(host: string, record_type = "A"): Promise<DnsResponse> {
  const { data } = await client.post<DnsResponse>("/network/dns", { host, record_type });
  return data;
}

export async function portCheck(host: string, port: number): Promise<PortCheckResponse> {
  const { data } = await client.post<PortCheckResponse>("/network/port-check", { host, port });
  return data;
}
