import { useEffect, useState } from "react";
import {
  addFirewallRule,
  deleteFirewallRule,
  disableFirewall,
  enableFirewall,
  getFirewallStatus,
} from "../api/firewall";
import type { FirewallStatus } from "../types/firewall";

export default function FirewallPage() {
  const [status, setStatus] = useState<FirewallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [port, setPort] = useState("");
  const [protocol, setProtocol] = useState("tcp");
  const [action, setAction] = useState("allow");

  async function reload() {
    setLoading(true);
    try {
      setStatus(await getFirewallStatus());
      setError(null);
    } catch {
      setError("Could not load firewall status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  function flash(message: string) {
    setMsg(message);
    setTimeout(() => setMsg(null), 4000);
  }

  async function toggleEnabled() {
    if (!status) return;
    setBusy(true);
    try {
      const fn = status.enabled ? disableFirewall : enableFirewall;
      const r = await fn();
      flash(r.message || (status.enabled ? "Firewall disabled" : "Firewall enabled"));
      await reload();
    } catch (e: unknown) {
      flash((e as Error).message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!port.trim()) return;
    setBusy(true);
    try {
      const r = await addFirewallRule(port.trim(), protocol, action);
      flash(r.message || "Rule added");
      setPort("");
      await reload();
    } catch (e: unknown) {
      flash((e as Error).message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(num: number) {
    setBusy(true);
    try {
      const r = await deleteFirewallRule(num);
      flash(r.message || "Rule deleted");
      await reload();
    } catch (e: unknown) {
      flash((e as Error).message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Firewall</h1>
        {status && (
          <button
            onClick={toggleEnabled}
            disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status.enabled
                ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
            }`}
          >
            {status.enabled ? "Disable" : "Enable"}
          </button>
        )}
      </div>

      {msg && (
        <div className="card bg-indigo-600/10 border border-indigo-500/30 text-indigo-300 text-sm">{msg}</div>
      )}

      {status?.error && (
        <div className="card bg-red-600/10 border border-red-500/30 text-red-400 text-sm">
          ufw error: {status.error}
        </div>
      )}

      {!loading && status && (
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${status.enabled ? "bg-emerald-400" : "bg-slate-500"}`}
          />
          <span className="text-sm text-slate-300">
            UFW {status.enabled ? "active" : "inactive"}
          </span>
          <span className="text-xs text-slate-500">· {status.rules.length} rules</span>
        </div>
      )}

      {/* Add rule form */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">New Rule</h2>
        <form onSubmit={handleAddRule} className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Port</label>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="e.g. 8080"
              className="bg-slate-700 text-sm text-slate-200 rounded px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-indigo-500 w-28"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Protocol</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="bg-slate-700 text-sm text-slate-200 rounded px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-indigo-500"
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="any">Both</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="bg-slate-700 text-sm text-slate-200 rounded px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-indigo-500"
            >
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
              <option value="reject">Reject</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || !port}
            className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </form>
      </div>

      {/* Rules list */}
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Rules</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : status && status.rules.length === 0 ? (
          <p className="text-sm text-slate-500">No rules defined</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-4">#</th>
                <th className="pb-2 pr-4">To (Port/Service)</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">From</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {status?.rules.map((rule) => (
                <tr key={rule.num} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="py-2 pr-4 text-slate-500">{rule.num}</td>
                  <td className="py-2 pr-4 font-mono text-slate-200">{rule.to}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        rule.action === "ALLOW"
                          ? "bg-emerald-600/20 text-emerald-400"
                          : "bg-red-600/20 text-red-400"
                      }`}
                    >
                      {rule.action}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{rule.from_}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(rule.num)}
                      disabled={busy}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
