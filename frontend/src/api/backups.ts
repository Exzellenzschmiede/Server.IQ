import client from "./client";

export interface Backup {
  id: number;
  name: string;
  created_at: string;
  completed_at: string | null;
  size_bytes: number;
  backup_path: string;
  backup_type: string;
  status: string;
  error: string | null;
}

export interface BackupCreate {
  name: string;
  include_paths: string[];
  db_connection_id?: number | null;
  db_name?: string | null;
}

export const listBackups = async (): Promise<Backup[]> => {
  const { data } = await client.get<Backup[]>("/backups");
  return data;
};

export const createBackup = async (body: BackupCreate): Promise<Backup> => {
  const { data } = await client.post<Backup>("/backups", body);
  return data;
};

export const deleteBackup = async (id: number): Promise<void> => {
  await client.delete(`/backups/${id}`);
};

export const getDownloadUrl = (id: number): string =>
  `/api/v1/backups/${id}/download`;
