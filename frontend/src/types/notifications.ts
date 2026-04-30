export interface NotificationConfig {
  telegram_enabled: boolean;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  email_enabled: boolean;
  email_smtp_host: string | null;
  email_smtp_port: number;
  email_smtp_user: string | null;
  email_smtp_password: string | null;
  email_from: string | null;
  email_to: string | null;
  check_interval_minutes: number;
  notify_on_failure: boolean;
  notify_on_recovery: boolean;
}
