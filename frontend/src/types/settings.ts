export interface AppConfig {
  upload_max_size_mb: number;
}

export interface ServiceConfig {
  id: number;
  key: string;
  display_name: string;
  host: string | null;
  port: number | null;
  enabled: boolean;
}

export interface ServiceConfigCreate {
  key: string;
  display_name: string;
  host: string | null;
  port: number | null;
  enabled: boolean;
}
