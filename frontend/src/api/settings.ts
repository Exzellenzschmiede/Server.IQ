import client from "./client";
import type { AppConfig, ServiceConfig, ServiceConfigCreate } from "../types/settings";

export const getAppConfig = async (): Promise<AppConfig> => {
  const { data } = await client.get<AppConfig>("/settings/app");
  return data;
};

export const updateAppConfig = async (body: Partial<AppConfig>): Promise<AppConfig> => {
  const { data } = await client.patch<AppConfig>("/settings/app", body);
  return data;
};

export const getMonitoredServices = async (): Promise<ServiceConfig[]> => {
  const { data } = await client.get("/settings/services");
  return data;
};

export const createMonitoredService = async (body: ServiceConfigCreate): Promise<ServiceConfig> => {
  const { data } = await client.post("/settings/services", body);
  return data;
};

export const updateMonitoredService = async (
  id: number,
  body: Partial<ServiceConfigCreate>,
): Promise<ServiceConfig> => {
  const { data } = await client.put(`/settings/services/${id}`, body);
  return data;
};

export const deleteMonitoredService = async (id: number): Promise<void> => {
  await client.delete(`/settings/services/${id}`);
};
