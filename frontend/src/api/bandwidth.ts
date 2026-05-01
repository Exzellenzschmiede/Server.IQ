import client from "./client";
import type { BandwidthResponse } from "../types/bandwidth";

export const getBandwidth = async (days = 30): Promise<BandwidthResponse> => {
  const { data } = await client.get<BandwidthResponse>("/bandwidth/", { params: { days } });
  return data;
};
