import { useEffect, useState } from "react";
import {
  getNotificationConfig,
  testNotification,
  updateNotificationConfig,
} from "../api/notifications";
import type { NotificationConfig } from "../types/notifications";

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-slate-700 text-sm text-slate-200 rounded px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative ${
          checked ? "bg-indigo-600" : "bg-slate-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </div>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

export default function NotificationsPage() {
  const [cfg, setCfg] = useState<NotificationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"telegram" | "email" | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getNotificationConfig()
      .then(setCfg)
      .finally(() => setLoading(false));
  }, []);

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  }

  function update<K extends keyof NotificationConfig>(key: K, value: NotificationConfig[K]) {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      const updated = await updateNotificationConfig(cfg);
      setCfg(updated);
      flash("Settings saved", true);
    } catch {
      flash("Error saving settings", false);
    } finally {
      setSaving(false);
    }
  }

  async function test(channel: "telegram" | "email") {
    setTesting(channel);
    try {
      const r = await testNotification(channel);
      flash(r.success ? `Test message sent (${channel})` : "Failed to send", r.success);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      flash(detail ?? "Error sending test message", false);
    } finally {
      setTesting(null);
    }
  }

  if (loading || !cfg) {
    return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold">Notifications</h1>

      {msg && (
        <div
          className={`card text-sm border ${
            msg.ok
              ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-600/10 border-red-500/30 text-red-400"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* General settings */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">General</h2>
        <Field
          label="Check interval (minutes)"
          value={cfg.check_interval_minutes}
          onChange={(v) => update("check_interval_minutes", parseInt(v) || 5)}
          type="number"
          placeholder="5"
        />
        <Toggle
          label="Notify on failure"
          checked={cfg.notify_on_failure}
          onChange={(v) => update("notify_on_failure", v)}
        />
        <Toggle
          label="Notify on recovery"
          checked={cfg.notify_on_recovery}
          onChange={(v) => update("notify_on_recovery", v)}
        />
      </div>

      {/* Telegram */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">Telegram</h2>
          <Toggle
            label="Enabled"
            checked={cfg.telegram_enabled}
            onChange={(v) => update("telegram_enabled", v)}
          />
        </div>
        <Field
          label="Bot Token"
          value={cfg.telegram_bot_token ?? ""}
          onChange={(v) => update("telegram_bot_token", v || null)}
          placeholder="1234567890:AAF..."
        />
        <Field
          label="Chat ID"
          value={cfg.telegram_chat_id ?? ""}
          onChange={(v) => update("telegram_chat_id", v || null)}
          placeholder="-100123456789"
        />
        <button
          onClick={() => test("telegram")}
          disabled={testing !== null || !cfg.telegram_bot_token}
          className="px-3 py-1.5 text-sm bg-sky-600/20 text-sky-400 rounded hover:bg-sky-600/30 disabled:opacity-50 transition-colors"
        >
          {testing === "telegram" ? "Sending…" : "Send test"}
        </button>
      </div>

      {/* Email */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">Email (SMTP)</h2>
          <Toggle
            label="Enabled"
            checked={cfg.email_enabled}
            onChange={(v) => update("email_enabled", v)}
          />
        </div>
        <p className="text-xs text-slate-500">
          Local Postfix: host <code className="text-slate-400">localhost</code>, port <code className="text-slate-400">25</code>, leave username and password empty.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="SMTP Host"
            value={cfg.email_smtp_host ?? ""}
            onChange={(v) => update("email_smtp_host", v || null)}
            placeholder="localhost"
          />
          <Field
            label="Port"
            value={cfg.email_smtp_port}
            onChange={(v) => update("email_smtp_port", parseInt(v) || 25)}
            type="number"
            placeholder="25"
          />
          <Field
            label="Username"
            value={cfg.email_smtp_user ?? ""}
            onChange={(v) => update("email_smtp_user", v || null)}
            placeholder="user@example.com"
          />
          <Field
            label="Password"
            value={cfg.email_smtp_password ?? ""}
            onChange={(v) => update("email_smtp_password", v || null)}
            type="password"
            placeholder="••••••••"
          />
          <Field
            label="From address"
            value={cfg.email_from ?? ""}
            onChange={(v) => update("email_from", v || null)}
            placeholder="server-iq@example.com"
          />
          <Field
            label="To address"
            value={cfg.email_to ?? ""}
            onChange={(v) => update("email_to", v || null)}
            placeholder="admin@example.com"
          />
        </div>
        <button
          onClick={() => test("email")}
          disabled={testing !== null || !cfg.email_smtp_host}
          className="px-3 py-1.5 text-sm bg-sky-600/20 text-sky-400 rounded hover:bg-sky-600/30 disabled:opacity-50 transition-colors"
        >
          {testing === "email" ? "Sending…" : "Send test"}
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
