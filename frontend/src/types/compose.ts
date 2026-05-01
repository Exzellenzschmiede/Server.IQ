export interface ComposeProject {
  name: string;
  path: string;
  file: string;
  services: string[];
  status: "running" | "partial" | "stopped" | "unknown";
}

export interface ComposeActionResponse {
  success: boolean;
  project: string;
  action: string;
  output: string;
}
