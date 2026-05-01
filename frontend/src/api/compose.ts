import client from "./client";
import type { ComposeActionResponse, ComposeProject } from "../types/compose";

export const listComposeProjects = async (): Promise<ComposeProject[]> => {
  const { data } = await client.get<ComposeProject[]>("/compose/");
  return data;
};

export const composeAction = async (file: string, action: string): Promise<ComposeActionResponse> => {
  const { data } = await client.post<ComposeActionResponse>("/compose/action", { file, action });
  return data;
};
