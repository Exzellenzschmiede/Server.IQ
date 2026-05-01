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
