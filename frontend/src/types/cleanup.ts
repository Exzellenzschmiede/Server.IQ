export interface CleanableItem {
  key: string;
  label: string;
  description: string;
  size_bytes: number;
  count: number;
  available: boolean;
}

export interface CleanupScanResult {
  items: CleanableItem[];
  total_bytes: number;
}

export interface CleanupActionResult {
  key: string;
  ok: boolean;
  freed_bytes: number;
  message: string;
}

export interface CleanupResult {
  results: CleanupActionResult[];
  total_freed_bytes: number;
}
