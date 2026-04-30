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
