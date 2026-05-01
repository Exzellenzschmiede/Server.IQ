import client from "./client";
import type { CleanupResult, CleanupScanResult } from "../types/cleanup";

export async function scanDisk(): Promise<CleanupScanResult> {
  const { data } = await client.get<CleanupScanResult>("/cleanup/scan");
  return data;
}

export async function runCleanup(actions: string[]): Promise<CleanupResult> {
  const { data } = await client.post<CleanupResult>("/cleanup/run", { actions });
  return data;
}
