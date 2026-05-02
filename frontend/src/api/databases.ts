import client from "./client";

export interface DBConnection {
  id: number;
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
}

export interface DBConnectionCreate {
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface DatabaseInfo {
  name: string;
  size_bytes: number | null;
  owner: string | null;
}

export interface TableInfo {
  name: string;
  row_estimate: number | null;
  size_bytes: number | null;
}

export interface DBUserInfo {
  username: string;
  superuser: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: (string | null)[][];
  rowcount: number;
  error: string | null;
}

export const listConnections = async (): Promise<DBConnection[]> => {
  const { data } = await client.get<DBConnection[]>("/databases/connections");
  return data;
};

export const createConnection = async (body: DBConnectionCreate): Promise<DBConnection> => {
  const { data } = await client.post<DBConnection>("/databases/connections", body);
  return data;
};

export const deleteConnection = async (id: number): Promise<void> => {
  await client.delete(`/databases/connections/${id}`);
};

export const listDatabases = async (connId: number): Promise<DatabaseInfo[]> => {
  const { data } = await client.get<DatabaseInfo[]>(`/databases/${connId}/databases`);
  return data;
};

export const createDatabase = async (connId: number, name: string): Promise<void> => {
  await client.post(`/databases/${connId}/databases`, { name });
};

export const dropDatabase = async (connId: number, name: string): Promise<void> => {
  await client.delete(`/databases/${connId}/databases/${name}`);
};

export const listTables = async (connId: number, dbName: string): Promise<TableInfo[]> => {
  const { data } = await client.get<TableInfo[]>(`/databases/${connId}/databases/${dbName}/tables`);
  return data;
};

export const listUsers = async (connId: number): Promise<DBUserInfo[]> => {
  const { data } = await client.get<DBUserInfo[]>(`/databases/${connId}/users`);
  return data;
};

export const createUser = async (connId: number, username: string, password: string): Promise<void> => {
  await client.post(`/databases/${connId}/users`, { username, password });
};

export const dropUser = async (connId: number, username: string): Promise<void> => {
  await client.delete(`/databases/${connId}/users/${username}`);
};

export const grantPrivileges = async (connId: number, username: string, database: string): Promise<void> => {
  await client.post(`/databases/${connId}/grant`, { username, database });
};

export const runQuery = async (connId: number, sql: string, database?: string): Promise<QueryResult> => {
  const { data } = await client.post<QueryResult>(`/databases/${connId}/query`, { sql, database });
  return data;
};
