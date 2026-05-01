export interface NginxStatus {
  available: boolean;
  version: string | null;
  running: boolean;
  config_test_ok: boolean | null;
}

export interface NginxSite {
  name: string;
  path: string;
  enabled: boolean;
  is_default: boolean;
}

export interface NginxSiteList {
  sites: NginxSite[];
}

export interface NginxConfigResponse {
  name: string;
  content: string;
  path: string;
}

export interface NginxTestResult {
  ok: boolean;
  output: string;
}

export interface NginxActionResult {
  ok: boolean;
  message: string;
}
