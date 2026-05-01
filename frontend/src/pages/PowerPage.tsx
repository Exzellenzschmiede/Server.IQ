import { useState } from "react";
import { systemPower } from "../api/system";
import { useAuth } from "../auth/AuthContext";
import Spinner from "../components/ui/Spinner";

type Action = "reboot" | "shutdown";

interface ActionConfig {
  label: string;
  description: string;
  warning: string;
  confirmText: string;
  buttonClass: string;
  icon: string;
}

const ACTIONS: Record<Action, ActionConfig> = {
  reboot: {
    label: "Reboot",
    description: "Restart the server. The system will come back online after a short downtime.",
    warning: "All running services will be interrupted during the reboot.",
    confirmText: "reboot",
    buttonClass: "bg-yellow-600 hover:bg-yellow-700 text-white",
    icon: "↺",
  },
  shutdown: {
    label: "Shutdown",
    description: "Power off the server. The system will not restart automatically.",
    warning: "The server will be unreachable until manually powered on again.",
    confirmText: "shutdown",
    buttonClass: "bg-red-700 hover:bg-red-800 text-white",
    icon: "⏻",
  },
};

export default function PowerPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!user?.is_admin) {
    return <div className="p-6 text-slate-400">Access denied.</div>;
  }

  const cfg = confirm ? ACTIONS[confirm] : null;

  async function execute() {
    if (!confirm) return;
    setPending(confirm);
    setConfirm(null);
    setInput("");
    try {
      const res = await systemPower(confirm);
      setResult({ ok: res.success, msg: res.message });
    } catch {
      setResult({ ok: false, msg: "Request failed." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-lg">
      <h1 className="text-xl font-bold">Power</h1>

      {result && (
        <div className={`card text-sm ${result.ok ? "bg-emerald-900/20 border border-emerald-500/20 text-emerald-400" : "bg-red-900/20 border border-red-500/20 text-red-400"}`}>
          {result.ok ? "✓ " : "✗ "}{result.msg}
        </div>
      )}

      <div className="space-y-3">
        {(Object.entries(ACTIONS) as [Action, ActionConfig][]).map(([action, c]) => (
          <div key={action} className="card space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-200">{c.icon} {c.label}</p>
                <p className="text-sm text-slate-400 mt-0.5">{c.description}</p>
                <p className="text-xs text-yellow-400 mt-1">⚠ {c.warning}</p>
              </div>
              <button
                onClick={() => { setConfirm(action); setInput(""); setResult(null); }}
                disabled={!!pending}
                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${c.buttonClass}`}
              >
                {pending === action ? <Spinner size="sm" /> : c.label}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation modal */}
      {confirm && cfg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="card w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-lg">Confirm {cfg.label}</h3>
            <p className="text-sm text-slate-400">
              Type <span className="font-mono text-slate-200">{cfg.confirmText}</span> to confirm.
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input === cfg.confirmText && execute()}
              placeholder={cfg.confirmText}
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirm(null); setInput(""); }} className="btn-ghost">Cancel</button>
              <button
                onClick={execute}
                disabled={input !== cfg.confirmText}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${cfg.buttonClass}`}
              >
                {cfg.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
