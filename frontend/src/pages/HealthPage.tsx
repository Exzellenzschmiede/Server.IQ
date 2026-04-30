import { useEffect, useState } from "react";
import { getHealth } from "../api/system";
import type { HealthReport, HealthStatus } from "../types/system";

const STATUS_STYLES: Record<HealthStatus, { dot: string; badge: string; label: string }> = {
  ok:       { dot: "bg-emerald-400", badge: "bg-emerald-600/20 text-emerald-300 border-emerald-500/30", label: "OK" },
  warning:  { dot: "bg-yellow-400",  badge: "bg-yellow-600/20 text-yellow-300 border-yellow-500/30",   label: "Warnung" },
  critical: { dot: "bg-red-400",     badge: "bg-red-600/20 text-red-300 border-red-500/30",             label: "Kritisch" },
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

  async function load() {
    setLoading(true);
    try {
      setReport(await getHealth());
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const overallStyle = report ? STATUS_STYLES[report.overall] : STATUS_STYLES.ok;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">System Health</h1>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-slate-500">Geprüft {lastChecked.toLocaleTimeString()}</span>
          )}
          <button onClick={load} disabled={loading} className="btn-ghost">Refresh</button>
        </div>
      </div>

      {/* Overall banner */}
      {report && (
        <div className={`card border flex items-center gap-4 ${overallStyle.badge}`}>
          <span className={`w-4 h-4 rounded-full flex-shrink-0 ${overallStyle.dot}`} />
          <div>
            <p className="font-semibold">
              Gesamtstatus: {overallStyle.label}
            </p>
            <p className="text-xs opacity-75">
              {report.checks.filter((c) => c.status !== "ok").length === 0
                ? "Alle Checks bestanden"
                : `${report.checks.filter((c) => c.status === "critical").length} kritisch, ${report.checks.filter((c) => c.status === "warning").length} Warnungen`}
            </p>
          </div>
          {report.updates_available !== null && report.updates_available > 0 && (
            <div className="ml-auto text-right">
              <p className="text-sm font-semibold">{report.updates_available}</p>
              <p className="text-xs opacity-75">Updates verfügbar</p>
            </div>
          )}
        </div>
      )}

      {loading && !report && (
        <div className="card text-center py-12 text-slate-500">Lade Health-Daten…</div>
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
                  {check.detail && (
                    <p className="text-xs text-slate-500 mt-0.5">{check.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
