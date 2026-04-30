import client from "./client";
import type { CronJob, CronListResponse } from "../types/cron";

export async function getCronJobs(): Promise<CronListResponse> {
  const { data } = await client.get<CronListResponse>("/cron");
  return data;
}

export async function addCronJob(schedule: string, command: string): Promise<CronJob> {
  const { data } = await client.post<CronJob>("/cron", { schedule, command });
  return data;
}

export async function deleteCronJob(index: number): Promise<void> {
  await client.delete(`/cron/${index}`);
}
