import client from "./client";
import type { FirewallStatus } from "../types/firewall";

export async function getFirewallStatus(): Promise<FirewallStatus> {
  const { data } = await client.get<FirewallStatus>("/firewall");
  return data;
}

export async function enableFirewall(): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post("/firewall/enable");
  return data;
}

export async function disableFirewall(): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post("/firewall/disable");
  return data;
}

export async function addFirewallRule(
  port: string,
  protocol: string,
  action: string,
): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post("/firewall/rules", { port, protocol, action });
  return data;
}

export async function deleteFirewallRule(num: number): Promise<{ success: boolean; message: string }> {
  const { data } = await client.delete(`/firewall/rules/${num}`);
  return data;
}
