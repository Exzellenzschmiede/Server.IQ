import client from "./client";
import type { NotificationConfig } from "../types/notifications";

export async function getNotificationConfig(): Promise<NotificationConfig> {
  const { data } = await client.get<NotificationConfig>("/notifications");
  return data;
}

export async function updateNotificationConfig(
  updates: Partial<NotificationConfig>,
): Promise<NotificationConfig> {
  const { data } = await client.patch<NotificationConfig>("/notifications", updates);
  return data;
}

export async function testNotification(channel: "telegram" | "email"): Promise<{ success: boolean }> {
  const { data } = await client.post<{ success: boolean }>("/notifications/test", { channel });
  return data;
}

export interface AlertHistoryEntry {
  id: number;
  recorded_at: string;
  channel: string;
  service_key: string;
  event: string;
  message: string;
}

export async function getAlertHistory(limit = 100): Promise<AlertHistoryEntry[]> {
  const { data } = await client.get<AlertHistoryEntry[]>("/notifications/history", { params: { limit } });
  return data;
}
