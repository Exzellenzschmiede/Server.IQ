import client from "./client";
import type { Fail2banStatus } from "../types/fail2ban";

export const getFail2banStatus = async (): Promise<Fail2banStatus> => {
  const { data } = await client.get<Fail2banStatus>("/fail2ban/");
  return data;
};

export const unbanIp = async (jail: string, ip: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await client.post("/fail2ban/unban", { jail, ip });
  return data;
};
