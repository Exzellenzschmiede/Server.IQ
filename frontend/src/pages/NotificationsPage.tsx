import { useEffect, useRef, useState } from "react";
import {
  getAlertHistory,
  getNotificationConfig,
  testNotification,
  updateNotificationConfig,
  type AlertHistoryEntry,
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

type Msg = { text: string; ok: boolean } | null;

function InlineMsg({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`text-xs mt-1 ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>
      {msg.ok ? "✓" : "✗"} {msg.text}
    </p>
  );
}

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export default function NotificationsPage() {
  const [cfg, setCfg] = useState<NotificationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [testing, setTesting] = useState<"telegram" | "email" | null>(null);

  const [telegramMsg, setTelegramMsg] = useState<Msg>(null);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cfgRef = useRef<NotificationConfig | null>(null);

  useEffect(() => {
    getNotificationConfig()
      .then(setCfg)
      .finally(() => setLoading(false));
    getAlertHistory(50).then(setHistory).catch(() => {});
  }, []);

  function flash(set: (m: Msg) => void, text: string, ok: boolean) {
    set({ text, ok });
    setTimeout(() => set(null), 6000);
  }

  function update<K extends keyof NotificationConfig>(key: K, value: NotificationConfig[K]) {
    setCfg((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      cfgRef.current = next;
      scheduleSave();
      return next;
    });
  }

  function scheduleSave() {
    setSaveStatus("pending");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const snapshot = cfgRef.current;
      if (!snapshot) return;
      setSaveStatus("saving");
      try {
        const updated = await updateNotificationConfig(snapshot);
        setCfg(updated);
        cfgRef.current = updated;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } catch {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 6000);
      }
    }, 800);
  }

  async function test(channel: "telegram" | "email") {
    const setMsg = channel === "telegram" ? setTelegramMsg : setEmailMsg;
    setTesting(channel);
    try {
      const r = await testNotification(channel);
      flash(setMsg, r.success ? `Test message sent (${channel})` : "Failed to send", r.success);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      flash(setMsg, detail ?? "Error sending test message", false);
    } finally {
      setTesting(null);
    }
  }

  if (loading || !cfg) {
    return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  }

  const saveIndicator =
    saveStatus === "pending" || saveStatus === "saving" ? (
      <span className="text-xs text-slate-500">Saving…</span>
    ) : saveStatus === "saved" ? (
      <span className="text-xs text-emerald-400">✓ Saved</span>
    ) : saveStatus === "error" ? (
      <span className="text-xs text-red-400">✗ Error saving</span>
    ) : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications</h1>
        {saveIndicator}
      </div>

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
        <div>
          <button
            onClick={() => test("telegram")}
            disabled={testing !== null || !cfg.telegram_bot_token || !cfg.telegram_chat_id}
            className="px-3 py-1.5 text-sm bg-sky-600/20 text-sky-400 rounded hover:bg-sky-600/30 disabled:opacity-50 transition-colors"
          >
            {testing === "telegram" ? "Sending…" : "Send test"}
          </button>
          <InlineMsg msg={telegramMsg} />
        </div>
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
          Local Postfix: host <code className="text-slate-400">localhost</code>, port{" "}
          <code className="text-slate-400">25</code>, leave username and password empty.
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
        <div>
          <button
            onClick={() => test("email")}
            disabled={testing !== null || !cfg.email_smtp_host || !cfg.email_from || !cfg.email_to}
            className="px-3 py-1.5 text-sm bg-sky-600/20 text-sky-400 rounded hover:bg-sky-600/30 disabled:opacity-50 transition-colors"
          >
            {testing === "email" ? "Sending…" : "Send test"}
          </button>
          <InlineMsg msg={emailMsg} />
        </div>
      </div>

      {/* Alert history */}
      {history.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Alert History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-left">
                  <th className="pb-2 pr-4 font-medium">Time</th>
                  <th className="pb-2 pr-4 font-medium">Channel</th>
                  <th className="pb-2 pr-4 font-medium">Service</th>
                  <th className="pb-2 pr-4 font-medium">Event</th>
                  <th className="pb-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {history.map((h) => (
                  <tr key={h.id} className="text-slate-400">
                    <td className="py-1.5 pr-4 whitespace-nowrap text-slate-500">
                      {new Date(h.recorded_at).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-4 capitalize">{h.channel}</td>
                    <td className="py-1.5 pr-4 font-mono">{h.service_key}</td>
                    <td className={`py-1.5 pr-4 font-medium ${h.event === "down" ? "text-red-400" : "text-emerald-400"}`}>
                      {h.event}
                    </td>
                    <td className="py-1.5 text-slate-500 truncate max-w-xs">{h.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
