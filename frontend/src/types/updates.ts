export interface PendingUpdate {
  package: string;
  current_version: string;
  new_version: string;
  architecture: string;
}

export interface UpdatesResponse {
  updates: PendingUpdate[];
  count: number;
  apt_available: boolean;
}

export interface UpgradeResponse {
  success: boolean;
  output: string;
}
