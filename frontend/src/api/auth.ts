import axios from "axios";
import type { TokenResponse, UserInfo } from "../types/auth";

export async function checkSetup(): Promise<{ setup_required: boolean }> {
  const { data } = await axios.get("/api/v1/auth/setup");
  return data;
}

export async function createAdmin(
  username: string,
  password: string
): Promise<TokenResponse> {
  const { data } = await axios.post("/api/v1/auth/setup", { username, password });
  return data;
}

export async function login(
  username: string,
  password: string
): Promise<TokenResponse> {
  const { data } = await axios.post("/api/v1/auth/login", { username, password });
  return data;
}

export async function getMe(): Promise<UserInfo> {
  const { data } = await axios.get("/api/v1/auth/me", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    },
  });
  return data;
}
