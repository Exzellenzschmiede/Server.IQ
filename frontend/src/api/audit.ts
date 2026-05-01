import client from "./client";

export interface AuditLogEntry {
  id: number;
  recorded_at: string;
  user_email: string | null;
  action: string;
  resource: string | null;
  detail: string | null;
  ip: string | null;
}

export interface AuditLogList {
  entries: AuditLogEntry[];
  total: number;
}

export async function getAuditLogs(params?: {
  limit?: number;
  offset?: number;
  action?: string;
  user_email?: string;
}): Promise<AuditLogList> {
  const { data } = await client.get<AuditLogList>("/audit", { params });
  return data;
}

export async function clearAuditLogs(): Promise<void> {
  await client.delete("/audit");
}
