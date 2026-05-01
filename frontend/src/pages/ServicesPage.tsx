import { useCallback, useEffect, useRef, useState } from "react";
import { getServiceDetail, getServiceLogs, getServices, serviceAction } from "../api/system";
import { useAuth } from "../auth/AuthContext";
import StatusBadge from "../components/ui/StatusBadge";
import Spinner from "../components/ui/Spinner";
import type { ServiceDetail, ServiceLogs, ServiceStatus } from "../types/system";

type ActionKey = "start" | "stop" | "restart";

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function LogModal({ serviceKey, onClose }: { serviceKey: string; onClose: () => void }) {
  const [logs, setLogs] = useState<ServiceLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState(100);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getServiceLogs(serviceKey, lines)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [serviceKey, lines]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function lineColor(line: string): string {
    const l = line.toLowerCase();
    if (l.includes("error") || l.includes("failed") || l.includes("crit")) return "text-red-400";
    if (l.includes("warn")) return "text-yellow-400";
    return "text-slate-300";
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-200">Logs — {serviceKey}</span>
            <div className="flex gap-1">
              {[50, 100, 200, 500].map((n) => (
                <button
                  key={n}
                  onClick={() => setLines(n)}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    lines === n ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-3 bg-slate-900 font-mono text-xs leading-relaxed">
          {loading ? (
            <div className="flex justify-center pt-8"><Spinner /></div>
          ) : logs && logs.lines.length > 0 ? (
            logs.lines.map((line, i) => (
              <div key={i} className={lineColor(line)}>{line}</div>
            ))
          ) : (
            <p className="text-slate-500 text-center pt-8">No log entries</p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

function ServiceRow({ service, isAdmin, onRefresh }: { service: ServiceStatus; isAdmin: boolean; onRefresh: () => void }) {
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ServiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  async function run(action: ActionKey) {
    setPending(action);
    setFeedback(null);
    try {
      const res = await serviceAction(service.name, action);
      setFeedback({ ok: res.success, msg: res.success ? `${action} successful` : res.message });
      setTimeout(() => { onRefresh(); setDetail(null); }, 1200);
    } catch {
      setFeedback({ ok: false, msg: "Error executing action" });
    } finally {
      setPending(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  async function toggleExpand() {
    if (!expanded && !detail) {
      setDetailLoading(true);
      try {
        setDetail(await getServiceDetail(service.name));
      } finally {
        setDetailLoading(false);
      }
    }
    setExpanded((v) => !v);
  }

  const isActive = service.status === "active";

  return (
    <>
      {showLogs && <LogModal serviceKey={service.name} onClose={() => setShowLogs(false)} />}
      <div className="py-3 px-1 space-y-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button onClick={toggleExpand} className="text-left flex items-center gap-2 min-w-0">
            <span className="text-slate-500 text-xs">{expanded ? "▾" : "▸"}</span>
            <div>
              <p className="font-medium text-sm">{service.display_name}</p>
              <p className="text-xs text-slate-500">{service.name}</p>
            </div>
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <StatusBadge status={service.status} />
            <button
              onClick={() => setShowLogs(true)}
              className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-2 py-0.5 transition-colors"
            >
              Logs
            </button>
            {isAdmin && (
              <div className="flex gap-1">
                {!isActive && (
                  <button className="btn-primary py-0.5 px-2.5 text-xs" disabled={!!pending} onClick={() => run("start")}>
                    {pending === "start" ? <Spinner size="sm" /> : "Start"}
                  </button>
                )}
                {isActive && (
                  <button className="btn-ghost py-0.5 px-2.5 text-xs" disabled={!!pending} onClick={() => run("stop")}>
                    {pending === "stop" ? <Spinner size="sm" /> : "Stop"}
                  </button>
                )}
                <button className="btn-ghost py-0.5 px-2.5 text-xs" disabled={!!pending} onClick={() => run("restart")}>
                  {pending === "restart" ? <Spinner size="sm" /> : "Restart"}
                </button>
              </div>
            )}
          </div>
        </div>

        {feedback && (
          <p className={`text-xs ${feedback.ok ? "text-emerald-400" : "text-red-400"}`}>{feedback.msg}</p>
        )}

        {expanded && (
          <div className="ml-4 mt-1 bg-slate-700/30 rounded-lg p-3 text-xs space-y-1.5">
            {detailLoading ? (
              <div className="flex justify-center py-2"><Spinner /></div>
            ) : detail ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                {[
                  ["Description", detail.description],
                  ["State", `${detail.active_state} (${detail.sub_state})`],
                  ["Unit file", detail.unit_file_state],
                  ["PID", detail.main_pid ?? "—"],
                  ["Memory", detail.memory_bytes ? formatBytes(detail.memory_bytes) : "—"],
                  ["CPU time", detail.cpu_usage_ms ? `${(detail.cpu_usage_ms / 1000).toFixed(1)} s` : "—"],
                  ["Active since", detail.active_since ?? "—"],
                  ["Unit file path", detail.fragment_path ?? "—"],
                ].map(([label, val]) => (
                  <div key={label as string}>
                    <span className="text-slate-500">{label}: </span>
                    <span className="text-slate-300 break-all">{val}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

export default function ServicesPage() {
  const { user } = useAuth();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getServices()
      .then((res) => { setServices(res.services); setLastChecked(new Date()); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Services</h1>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-slate-500">Checked {lastChecked.toLocaleTimeString()}</span>
          )}
          <button onClick={refresh} disabled={loading} className="btn-ghost">Refresh</button>
        </div>
      </div>

      <div className="card divide-y divide-slate-700/50">
        {loading && services.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-sm">Loading…</p>
        ) : services.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-sm">No services found</p>
        ) : (
          services.map((s) => (
            <ServiceRow key={s.name} service={s} isAdmin={!!user?.is_admin} onRefresh={refresh} />
          ))
        )}
      </div>
    </div>
  );
}
