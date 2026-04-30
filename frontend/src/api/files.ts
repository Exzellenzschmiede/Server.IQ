import client from "./client";
import type { FileContentResponse, FileListResponse } from "../types/files";

export async function listFiles(path?: string): Promise<FileListResponse> {
  const params = path ? { path } : {};
  const { data } = await client.get<FileListResponse>("/files", { params });
  return data;
}

export async function readFile(path: string): Promise<FileContentResponse> {
  const { data } = await client.get<FileContentResponse>("/files/read", { params: { path } });
  return data;
}
