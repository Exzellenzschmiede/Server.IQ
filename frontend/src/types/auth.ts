export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type UserRole = "admin" | "user";

export interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_admin: boolean;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}
