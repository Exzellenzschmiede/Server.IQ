import client from "./client";
import type { UpdatesResponse, UpgradeResponse } from "../types/updates";

export const getUpdates = async (): Promise<UpdatesResponse> => {
  const { data } = await client.get<UpdatesResponse>("/updates/");
  return data;
};

export const fetchUpdates = async (): Promise<UpgradeResponse> => {
  const { data } = await client.post<UpgradeResponse>("/updates/fetch");
  return data;
};

export const runUpgrade = async (): Promise<UpgradeResponse> => {
  const { data } = await client.post<UpgradeResponse>("/updates/upgrade");
  return data;
};
