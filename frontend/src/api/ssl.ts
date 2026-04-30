import client from "./client";
import type { CertInfo } from "../types/ssl";

export async function getSslCerts(): Promise<CertInfo[]> {
  const { data } = await client.get<CertInfo[]>("/ssl");
  return data;
}
