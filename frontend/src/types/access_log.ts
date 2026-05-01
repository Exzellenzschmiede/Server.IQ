export interface SshLogEntry {
  timestamp: string;
  user: string | null;
  source_ip: string | null;
  event: "accepted" | "failed" | "invalid" | "disconnect" | "other";
  raw: string;
}

export interface NginxLogEntry {
  timestamp: string;
  source_ip: string;
  method: string;
  path: string;
  status: number;
  bytes_sent: number;
  user_agent: string;
}

export interface AccessLogResponse {
  ssh: SshLogEntry[];
  nginx: NginxLogEntry[];
}
