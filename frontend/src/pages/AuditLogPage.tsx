import { useEffect, useState } from "react";
import { clearAuditLogs, getAuditLogs } from "../api/audit";
import type { AuditLogEntry } from "../api/audit";

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString("en-US", { dateStyle: "short", timeStyle: "medium" });
}

const ACTION_COLORS: Record<string, string> = {
  "auth.login":            "text-emerald-400",
  "auth.logout":           "text-slate-400",
  "docker.action":         "text-sky-400",
  "docker.delete":         "text-red-400",
  "firewall.add_rule":     "text-yellow-400",
  "firewall.delete_rule":  "text-red-400",
  "files.write":           "text-indigo-400",
  "files.delete":          "text-red-400",
  "system.power":          "text-red-400",
  "system.service_action": "text-sky-400",
  "system.kill_process":   "text-red-400",
  "system.renice_process": "text-yellow-400",
  "cleanup.run":           "text-emerald-400",
  "ssh_keys.add":          "text-yellow-400",
  "ssh_keys.delete":       "text-red-400",
  "settings.update":       "text-indigo-400",
  "users.create":          "text-emerald-400",
  "users.delete":          "text-red-400",
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [clearing, setClearing] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await getAuditLogs({
        limit: 200,
        action: filterAction || undefined,
        user_email: filterUser || undefined,
      });
      setEntries(r.entries);
      setTotal(r.total);
    } catch {
      setError("Could not load audit log.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleClear() {
    if (!confirm("Clear all audit log entries? This cannot be undone.")) return;
    setClearing(true);
    try {
      await clearAuditLogs();
      setEntries([]);
      setTotal(0);
    } catch {
      setError("Failed to clear audit log.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Audit Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} total entries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-ghost">Refresh</button>
          <button onClick={handleClear} disabled={clearing} className="btn-ghost text-red-400 hover:text-red-300">
            {clearing ? "Clearing…" : "Clear all"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          placeholder="Filter by action…"
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <input
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          placeholder="Filter by user…"
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button onClick={load} disabled={loading} className="px-3 py-1.5 text-xs bg-indigo-600/20 text-indigo-300 rounded hover:bg-indigo-600/30 transition-colors">
          Apply
        </button>
        {(filterAction || filterUser) && (
          <button onClick={() => { setFilterAction(""); setFilterUser(""); }} className="text-xs text-slate-500 hover:text-slate-300 px-1">
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="card bg-red-600/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500 py-4 text-center">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No audit log entries</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-4 whitespace-nowrap">Time</th>
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4 hidden md:table-cell">Resource</th>
                <th className="pb-2 hidden lg:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="py-1.5 pr-4 text-xs text-slate-500 whitespace-nowrap font-mono">
                    {formatDate(e.recorded_at)}
                  </td>
                  <td className="py-1.5 pr-4 text-xs text-slate-400 max-w-[120px] truncate">
                    {e.user_email ?? "—"}
                  </td>
                  <td className="py-1.5 pr-4">
                    <span className={`text-xs font-mono font-medium ${ACTION_COLORS[e.action] ?? "text-slate-300"}`}>
                      {e.action}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4 text-xs text-slate-500 font-mono max-w-[200px] truncate hidden md:table-cell">
                    {e.resource ?? "—"}
                  </td>
                  <td className="py-1.5 text-xs text-slate-600 font-mono hidden lg:table-cell">
                    {e.ip ?? "—"}
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
