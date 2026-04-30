import client from "./client";
import type { ServiceConfig, ServiceConfigCreate } from "../types/settings";

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
