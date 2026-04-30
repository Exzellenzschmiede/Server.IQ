export interface FirewallRule {
  num: number;
  to: string;
  action: string;
  from_: string;
}

export interface FirewallStatus {
  enabled: boolean;
  rules: FirewallRule[];
  error?: string;
}
