export interface CertInfo {
  domain: string;
  not_before: string;
  not_after: string;
  days_remaining: number;
  expired: boolean;
}

export interface RenewResponse {
  domain: string;
  success: boolean;
  output: string;
}
