export interface ContainerPort {
  container_port: string;
  host_ip: string | null;
  host_port: string | null;
}

export interface ContainerInfo {
  id: string;
  short_id: string;
  name: string;
  image: string;
  status: string;       // machine-readable: "running", "exited"
  status_text: string;  // human-readable: "Up 2 hours"
  state: string;
  created: string;
  started_at: string | null;
  ports: ContainerPort[];
  labels: Record<string, string>;
  volumes: string[];
  networks: string[];
  restart_policy: string | null;
  env: string[];
}

export interface ContainerStats {
  container_id: string;
  cpu_percent: number;
  memory_bytes: number;
  memory_limit_bytes: number;
  memory_percent: number;
}

export interface ContainersResponse {
  containers: ContainerInfo[];
  total: number;
  running: number;
  stopped: number;
}

export interface ContainerActionResponse {
  success: boolean;
  container_id: string;
  action: string;
  message: string;
}

export interface ReinstallResponse {
  success: boolean;
  container_id: string;
  new_container_id: string | null;
  image_pulled: boolean;
  message: string;
}

export interface ImageInfo {
  id: string;
  short_id: string;
  tags: string[];
  size_bytes: number;
  created: string;
}
