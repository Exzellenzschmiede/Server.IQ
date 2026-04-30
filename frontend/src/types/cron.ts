export interface CronJob {
  index: number;
  raw: string;
  schedule: string;
  command: string;
  comment: string;
}

export interface CronListResponse {
  jobs: CronJob[];
  raw_header: string;
}
