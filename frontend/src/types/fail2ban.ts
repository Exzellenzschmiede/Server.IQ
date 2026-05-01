export interface Fail2banJail {
  name: string;
  currently_failed: number;
  total_failed: number;
  currently_banned: number;
  total_banned: number;
  banned_ips: string[];
}

export interface Fail2banStatus {
  available: boolean;
  active: boolean;
  jails: Fail2banJail[];
}
