export interface BandwidthDay {
  date: string;
  recv_bytes: number;
  sent_bytes: number;
}

export interface BandwidthResponse {
  days: BandwidthDay[];
  total_recv_bytes: number;
  total_sent_bytes: number;
}
