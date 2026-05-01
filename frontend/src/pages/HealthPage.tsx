import { useEffect, useState } from "react";
import { getHealth, getTopProcesses, killProcess, reniceProcess } from "../api/system";
import type { HealthReport, HealthStatus, ProcessInfo } from "../types/system";

const STATUS_STYLES: Record<HealthStatus, { dot: string; badge: string; label: string }> = {
  ok:       { dot: "bg-emerald-400", badge: "bg-emerald-600/20 text-emerald-300 border-emerald-500/30", label: "OK" },
  warning:  { dot: "bg-yellow-400",  badge: "bg-yellow-600/20 text-yellow-300 border-yellow-500/30",   label: "Warning" },
  critical: { dot: "bg-red-400",     badge: "bg-red-600/20 text-red-300 border-red-500/30",             label: "Critical" },
};

function StatusBadge({ status }: { status: HealthStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function HealthPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [procSort, setProcSort] = useState<"cpu" | "memory">("cpu");
  const [procMsg, setProcMsg] = useState<{ pid: number; text: string; ok: boolean } | null>(null);
  const [reniceTarget, setReniceTarget] = useState<ProcessInfo | null>(null);
  const [reniceValue, setReniceValue] = useState("10");
  const [procBusy, setProcBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      setReport(await getHealth());
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }

  async function loadProcesses() {
    try {
      setProcesses(await getTopProcesses(procSort, 15));
    } catch {/* ignore */}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadProcesses();
    const t = setInterval(loadProcesses, 5000);
    return () => clearInterval(t);
  }, [procSort]);

  async function handleKill(proc: ProcessInfo) {
    if (!confirm(`Kill process "${proc.name}" (PID ${proc.pid})?`)) return;
    setProcBusy(proc.pid);
    try {
      const r = await killProcess(proc.pid);
      setProcMsg({ pid: proc.pid, text: r.message, ok: r.success });
      if (r.success) await loadProcesses();
    } catch {
      setProcMsg({ pid: proc.pid, text: "Kill failed", ok: false });
    } finally {
      setProcBusy(null);
      setTimeout(() => setProcMsg(null), 4000);
    }
  }

  async function handleRenice() {
    if (!reniceTarget) return;
    const nice = parseInt(reniceValue, 10);
    if (isNaN(nice) || nice < -20 || nice > 19) return;
    setProcBusy(reniceTarget.pid);
    setReniceTarget(null);
    try {
      const r = await reniceProcess(reniceTarget.pid, nice);
      setProcMsg({ pid: reniceTarget.pid, text: r.message, ok: r.success });
      if (r.success) await loadProcesses();
    } catch {
      setProcMsg({ pid: reniceTarget.pid, text: "Renice failed", ok: false });
    } finally {
      setProcBusy(null);
      setTimeout(() => setProcMsg(null), 4000);
    }
  }

  const overallStyle = report ? STATUS_STYLES[report.overall] : STATUS_STYLES.ok;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">System Health</h1>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-slate-500">Checked {lastChecked.toLocaleTimeString()}</span>
          )}
          <button onClick={load} disabled={loading} className="btn-ghost">Refresh</button>
        </div>
      </div>

      {/* Overall banner */}
      {report && (
        <div className={`card border flex items-center gap-4 ${overallStyle.badge}`}>
          <span className={`w-4 h-4 rounded-full flex-shrink-0 ${overallStyle.dot}`} />
          <div>
            <p className="font-semibold">Overall status: {overallStyle.label}</p>
            <p className="text-xs opacity-75">
              {report.checks.filter((c) => c.status !== "ok").length === 0
                ? "All checks passed"
                : `${report.checks.filter((c) => c.status === "critical").length} critical, ${report.checks.filter((c) => c.status === "warning").length} warnings`}
            </p>
          </div>
          {report.updates_available !== null && report.updates_available > 0 && (
            <div className="ml-auto text-right">
              <p className="text-sm font-semibold">{report.updates_available}</p>
              <p className="text-xs opacity-75">updates available</p>
            </div>
          )}
        </div>
      )}

      {loading && !report && (
        <div className="card text-center py-12 text-slate-500">Loading health data…</div>
      )}

      {/* Check cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {report.checks.map((check) => {
            const s = STATUS_STYLES[check.status];
            return (
              <div key={check.name} className="card flex items-start gap-4">
                <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${s.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-200">{check.name}</p>
                    <StatusBadge status={check.status} />
                  </div>
                  <p className="text-xl font-bold mt-1 text-slate-100">{check.value}</p>
                  {check.detail && <p className="text-xs text-slate-500 mt-0.5">{check.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Process Manager */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-300">Top Processes</h2>
          <div className="flex gap-1 text-xs">
            {(["cpu", "memory"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setProcSort(s)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  procSort === s
                    ? "bg-indigo-600/30 text-indigo-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {s === "cpu" ? "CPU" : "Memory"}
              </button>
            ))}
          </div>
        </div>

        {procMsg && (
          <div className={`text-xs px-3 py-2 rounded border ${procMsg.ok ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-400" : "bg-red-900/20 border-red-500/30 text-red-400"}`}>
            {procMsg.text}
          </div>
        )}

        {/* Renice inline modal */}
        {reniceTarget && (
          <div className="bg-slate-900 rounded-lg p-3 border border-indigo-500/30 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400">
              Renice <span className="font-mono text-slate-200">{reniceTarget.name}</span> (PID {reniceTarget.pid})
            </span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Nice value (-20 to 19):</label>
              <input
                type="number"
                value={reniceValue}
                onChange={(e) => setReniceValue(e.target.value)}
                min={-20}
                max={19}
                className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleRenice} className="text-xs px-3 py-1 bg-indigo-600/20 text-indigo-300 rounded hover:bg-indigo-600/30 transition-colors">
                Apply
              </button>
              <button onClick={() => setReniceTarget(null)} className="text-xs text-slate-500 hover:text-slate-300">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-3">PID</th>
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3 text-right">CPU%</th>
                <th className="pb-2 pr-3 text-right">Mem%</th>
                <th className="pb-2 pr-3 hidden sm:table-cell">User</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => (
                <tr key={p.pid} className="border-b border-slate-700/40 hover:bg-slate-700/20">
                  <td className="py-1.5 pr-3 font-mono text-slate-500">{p.pid}</td>
                  <td className="py-1.5 pr-3 font-mono text-slate-300 max-w-[120px] truncate">{p.name}</td>
                  <td className="py-1.5 pr-3 text-right">
                    <span className={p.cpu_percent > 50 ? "text-red-400 font-semibold" : p.cpu_percent > 20 ? "text-yellow-400" : "text-slate-400"}>
                      {p.cpu_percent.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <span className={p.memory_percent > 50 ? "text-red-400 font-semibold" : p.memory_percent > 20 ? "text-yellow-400" : "text-slate-400"}>
                      {p.memory_percent.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-slate-500 hidden sm:table-cell">{p.username}</td>
                  <td className="py-1.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setReniceTarget(p); setReniceValue("10"); }}
                        disabled={procBusy === p.pid}
                        className="text-yellow-500 hover:text-yellow-400 disabled:opacity-40 transition-colors"
                        title="Renice"
                      >
                        ↕
                      </button>
                      <button
                        onClick={() => handleKill(p)}
                        disabled={procBusy === p.pid}
                        className="text-red-500 hover:text-red-400 disabled:opacity-40 transition-colors"
                        title="Kill"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {processes.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-slate-600">Loading processes…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
