import client from "./client";

export interface MailStatus {
  postfix_installed: boolean;
  dovecot_installed: boolean;
  postfix_running: boolean;
  dovecot_running: boolean;
}

export interface Mailbox {
  email: string;
  domain: string;
  local_part: string;
}

export interface MailAlias {
  source: string;
  destination: string;
}

export interface MailQueueItem {
  queue_id: string;
  size: string;
  arrival_time: string;
  sender: string;
  recipients: string[];
  status: string;
}

export const getMailStatus = async (): Promise<MailStatus> => {
  const { data } = await client.get<MailStatus>("/email/status");
  return data;
};

export const listMailboxes = async (): Promise<Mailbox[]> => {
  const { data } = await client.get<Mailbox[]>("/email/mailboxes");
  return data;
};

export const createMailbox = async (email: string, password: string): Promise<void> => {
  await client.post("/email/mailboxes", { email, password });
};

export const deleteMailbox = async (email: string): Promise<void> => {
  await client.delete(`/email/mailboxes/${encodeURIComponent(email)}`);
};

export const listAliases = async (): Promise<MailAlias[]> => {
  const { data } = await client.get<MailAlias[]>("/email/aliases");
  return data;
};

export const createAlias = async (source: string, destination: string): Promise<void> => {
  await client.post("/email/aliases", { source, destination });
};

export const deleteAlias = async (source: string): Promise<void> => {
  await client.delete(`/email/aliases/${encodeURIComponent(source)}`);
};

export const getMailQueue = async (): Promise<MailQueueItem[]> => {
  const { data } = await client.get<MailQueueItem[]>("/email/queue");
  return data;
};

export const flushMailQueue = async (): Promise<void> => {
  await client.post("/email/queue/flush");
};

export const deleteQueueItem = async (queueId: string): Promise<void> => {
  await client.delete(`/email/queue/${queueId}`);
};
