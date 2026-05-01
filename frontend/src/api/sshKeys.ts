import client from "./client";

export interface SshKey {
  index: number;
  type: string;
  fingerprint: string;
  comment: string;
  raw: string;
}

export async function getSshKeys(): Promise<SshKey[]> {
  const { data } = await client.get<SshKey[]>("/ssh-keys");
  return data;
}

export async function addSshKey(key: string): Promise<void> {
  await client.post("/ssh-keys", { key });
}

export async function deleteSshKey(index: number): Promise<void> {
  await client.delete(`/ssh-keys/${index}`);
}
