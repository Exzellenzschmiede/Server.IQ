import client from "./client";
import type {
  NginxActionResult,
  NginxConfigResponse,
  NginxSiteList,
  NginxStatus,
  NginxTestResult,
} from "../types/nginx";

export async function getNginxStatus(): Promise<NginxStatus> {
  const { data } = await client.get<NginxStatus>("/nginx/status");
  return data;
}

export async function getNginxSites(): Promise<NginxSiteList> {
  const { data } = await client.get<NginxSiteList>("/nginx/sites");
  return data;
}

export async function getNginxConfig(name: string): Promise<NginxConfigResponse> {
  const { data } = await client.get<NginxConfigResponse>("/nginx/config", { params: { name } });
  return data;
}

export async function saveNginxConfig(name: string, content: string): Promise<NginxActionResult> {
  const { data } = await client.put<NginxActionResult>("/nginx/config", { name, content });
  return data;
}

export async function deleteNginxConfig(name: string): Promise<NginxActionResult> {
  const { data } = await client.delete<NginxActionResult>("/nginx/config", { params: { name } });
  return data;
}

export async function enableSite(name: string): Promise<NginxActionResult> {
  const { data } = await client.post<NginxActionResult>(`/nginx/sites/${encodeURIComponent(name)}/enable`);
  return data;
}

export async function disableSite(name: string): Promise<NginxActionResult> {
  const { data } = await client.post<NginxActionResult>(`/nginx/sites/${encodeURIComponent(name)}/disable`);
  return data;
}

export async function testNginxConfig(): Promise<NginxTestResult> {
  const { data } = await client.post<NginxTestResult>("/nginx/test");
  return data;
}

export async function reloadNginx(): Promise<NginxActionResult> {
  const { data } = await client.post<NginxActionResult>("/nginx/reload");
  return data;
}

export async function restartNginx(): Promise<NginxActionResult> {
  const { data } = await client.post<NginxActionResult>("/nginx/restart");
  return data;
}
