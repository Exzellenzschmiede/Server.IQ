export interface AppConfig {
  upload_max_size_mb: number;
  ai_provider: string | null;
  ai_model: string | null;
  ai_api_key: string | null;
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
