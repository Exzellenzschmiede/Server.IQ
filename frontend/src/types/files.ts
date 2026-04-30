export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

export interface FileListResponse {
  path: string;
  entries: FileEntry[];
  allowed_roots: string[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  truncated: boolean;
}
