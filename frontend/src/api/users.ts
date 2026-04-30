import client from "./client";
import type { UserResponse, UserRole } from "../types/auth";

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
}

export async function listUsers(): Promise<UserResponse[]> {
  const { data } = await client.get<UserResponse[]>("/users");
  return data;
}

export async function createUser(body: UserCreate): Promise<UserResponse> {
  const { data } = await client.post<UserResponse>("/users", body);
  return data;
}

export async function updateUser(id: number, body: UserUpdate): Promise<UserResponse> {
  const { data } = await client.put<UserResponse>(`/users/${id}`, body);
  return data;
}

export async function resetPassword(id: number, password: string): Promise<UserResponse> {
  const { data } = await client.post<UserResponse>(`/users/${id}/reset-password`, { password });
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await client.delete(`/users/${id}`);
}

export async function generatePassword(): Promise<string> {
  const { data } = await client.get<{ password: string }>("/users/generate-password");
  return data.password;
}
