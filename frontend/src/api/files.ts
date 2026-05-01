import client from "./client";
import type { FileContentResponse, FileListResponse, FileOpResponse } from "../types/files";

export async function listFiles(path?: string): Promise<FileListResponse> {
  const params = path ? { path } : {};
  const { data } = await client.get<FileListResponse>("/files", { params });
  return data;
}

export async function readFile(path: string): Promise<FileContentResponse> {
  const { data } = await client.get<FileContentResponse>("/files/read", { params: { path } });
  return data;
}

export async function writeFile(path: string, content: string): Promise<FileContentResponse> {
  const { data } = await client.post<FileContentResponse>("/files/write", { path, content });
  return data;
}

export async function createDir(path: string): Promise<FileOpResponse> {
  const { data } = await client.post<FileOpResponse>("/files/mkdir", { path });
  return data;
}

export async function deleteEntry(path: string): Promise<void> {
  await client.delete("/files/delete", { params: { path } });
}

export async function copyEntry(src: string, dst: string): Promise<FileOpResponse> {
  const { data } = await client.post<FileOpResponse>("/files/copy", { src, dst });
  return data;
}

export async function uploadFiles(
  dest: string,
  items: { file: File; relativePath: string }[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ uploaded: number; dest: string }> {
  const form = new FormData();
  form.append("dest", dest);
  const paths: string[] = [];
  for (const { file, relativePath } of items) {
    form.append("files", file);
    paths.push(relativePath);
  }
  form.append("paths", JSON.stringify(paths));
  const { data } = await client.post<{ uploaded: number; dest: string }>("/files/upload", form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(e.loaded, e.total);
    },
  });
  return data;
}
