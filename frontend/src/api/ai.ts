import client from "./client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  provider: string;
  model: string;
}

export interface AnalyzeLogsResponse {
  analysis: string;
  provider: string;
  model: string;
}

export interface CronHelpResponse {
  expression: string;
  explanation: string;
  provider: string;
  model: string;
}

export const PROVIDER_MODELS: Record<string, string[]> = {
  anthropic: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  openai:    ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  mistral:   ["mistral-large-latest", "mistral-small-latest", "open-mistral-7b"],
  gemini:    ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
};

export async function aiChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const { data } = await client.post<ChatResponse>("/ai/chat", { messages });
  return data;
}

export async function analyzeLogs(logs: string, context?: string): Promise<AnalyzeLogsResponse> {
  const { data } = await client.post<AnalyzeLogsResponse>("/ai/analyze-logs", { logs, context });
  return data;
}

export async function cronHelp(description: string): Promise<CronHelpResponse> {
  const { data } = await client.post<CronHelpResponse>("/ai/cron-help", { description });
  return data;
}
