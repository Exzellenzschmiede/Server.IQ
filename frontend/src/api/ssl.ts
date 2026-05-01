import client from "./client";
import type { CertInfo, RenewResponse } from "../types/ssl";

export async function getSslCerts(): Promise<CertInfo[]> {
  const { data } = await client.get<CertInfo[]>("/ssl");
  return data;
}

export async function renewCert(domain: string): Promise<RenewResponse> {
  const { data } = await client.post<RenewResponse>(`/ssl/${encodeURIComponent(domain)}/renew`);
  return data;
}
