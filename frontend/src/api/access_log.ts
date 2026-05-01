import client from "./client";
import type { AccessLogResponse } from "../types/access_log";

export const getAccessLog = async (limit = 200): Promise<AccessLogResponse> => {
  const { data } = await client.get<AccessLogResponse>("/access-log/", { params: { limit } });
  return data;
};
