import client from "./client";

export interface VHost {
  domain: string;
  root_path: string;
  vhost_type: string;
  php_version: string;
  proxy_pass: string;
  enabled: boolean;
  ssl: boolean;
  config_path: string;
  is_default: boolean;
}

export interface VHostCreate {
  domain: string;
  root_path?: string;
  vhost_type: string;
  php_version?: string;
  proxy_pass?: string;
}

export const getVHosts = async (): Promise<VHost[]> => {
  const { data } = await client.get<VHost[]>("/vhosts");
  return data;
};

export const createVHost = async (body: VHostCreate): Promise<VHost> => {
  const { data } = await client.post<VHost>("/vhosts", body);
  return data;
};

export const deleteVHost = async (domain: string): Promise<void> => {
  await client.delete(`/vhosts/${domain}`);
};

export const toggleVHost = async (domain: string, enabled: boolean): Promise<void> => {
  await client.patch(`/vhosts/${domain}/toggle`, null, { params: { enabled } });
};

export const getVHostConfig = async (domain: string): Promise<string> => {
  const { data } = await client.get<{ config: string }>(`/vhosts/${domain}/config`);
  return data.config;
};

export const updateVHostConfig = async (domain: string, config: string): Promise<void> => {
  await client.put(`/vhosts/${domain}/config`, { config });
};

export const enableSSL = async (domain: string): Promise<{ success: boolean; output: string }> => {
  const { data } = await client.post(`/vhosts/${domain}/ssl`);
  return data;
};
