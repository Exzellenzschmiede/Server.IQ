import { useEffect, useState } from "react";
import { getContainerStats } from "../api/docker";
import LogViewer from "../components/containers/LogViewer";
import ContainerActions from "../components/containers/ContainerActions";
import StatusBadge from "../components/ui/StatusBadge";
import { useContainerLogs } from "../hooks/useContainerLogs";
import { useContainers } from "../hooks/useContainers";
import type { ContainerInfo, ContainerStats } from "../types/docker";

type Filter = "all" | "running" | "stopped";

function ContainerLogModal({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const { lines, connected, clear, reconnect } = useContainerLogs(id);
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <span className="font-semibold text-slate-200">Logs — {name}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 min-h-0">
          <LogViewer lines={lines} connected={connected} onClear={clear} onReconnect={reconnect} />
        </div>
      </div>
    </div>
  );
}

function fmt(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + " GB";
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(0) + " MB";
  return (bytes / 1024).toFixed(0) + " KB";
}

function ContainerRow({
  container,
  onRefresh,
  onShowLogs,
}: {
  container: ContainerInfo;
  onRefresh: () => void;
  onShowLogs: (c: ContainerInfo) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [showEnv, setShowEnv] = useState(false);

  useEffect(() => {
    if (!expanded || container.status !== "running") {
      setStats(null);
      return;
    }
    let active = true;
    const fetch = async () => {
      try {
        const s = await getContainerStats(container.id);
        if (active) setStats(s);
      } catch { /* container may have stopped */ }
    };
    fetch();
    const t = setInterval(fetch, 5000);
    return () => { active = false; clearInterval(t); };
  }, [expanded, container.id, container.status]);

  const boundPorts = container.ports.filter((p) => p.host_port);

  return (
    <div className="py-3 px-1 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-left flex items-center gap-2 min-w-0"
        >
          <span className="text-slate-500 text-xs">{expanded ? "▾" : "▸"}</span>
          <div className="min-w-0">
            <p className="font-medium text-sm">{container.name}</p>
            <p className="text-xs text-slate-500 truncate max-w-xs">{container.image}</p>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <StatusBadge status={container.status} />
          <button
            onClick={() => onShowLogs(container)}
            className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-2 py-0.5 transition-colors"
          >
            Logs
          </button>
          <ContainerActions
            container={container}
            onRefresh={onRefresh}
            compact
          />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="ml-4 mt-1 bg-slate-700/30 rounded-lg p-3 space-y-3 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-slate-400">
            <div><span className="text-slate-500">ID: </span>{container.short_id}</div>
            {container.status_text && container.status_text !== container.status && (
              <div><span className="text-slate-500">State: </span>{container.status_text}</div>
            )}
            {container.started_at && (
              <div><span className="text-slate-500">Started: </span>{new Date(container.started_at).toLocaleString()}</div>
            )}
            {container.restart_policy && (
              <div><span className="text-slate-500">Restart: </span>{container.restart_policy}</div>
            )}
            {boundPorts.length > 0 && (
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-500">Ports: </span>
                {boundPorts.map((p) => `${p.host_port}→${p.container_port}`).join(", ")}
              </div>
            )}
            {container.networks.length > 0 && (
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-500">Networks: </span>
                {container.networks.join(", ")}
              </div>
            )}
          </div>

          {container.volumes.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-slate-500 font-medium">Volumes</p>
              {container.volumes.map((v, i) => (
                <p key={i} className="font-mono text-slate-500 truncate">{v}</p>
              ))}
            </div>
          )}

          {container.env && container.env.length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setShowEnv((v) => !v)}
                className="text-slate-500 hover:text-slate-300 font-medium flex items-center gap-1"
              >
                {showEnv ? "▾" : "▸"} Env vars ({container.env.length})
              </button>
              {showEnv && (
                <div className="bg-slate-900/60 rounded p-2 space-y-0.5 max-h-40 overflow-auto">
                  {container.env.map((e, i) => (
                    <p key={i} className="font-mono text-slate-400 break-all">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {stats && (
            <div className="flex gap-4 bg-slate-900/60 rounded px-3 py-2">
              <div>
                <span className="text-slate-500">CPU </span>
                <span className="text-slate-300 font-medium">{stats.cpu_percent}%</span>
              </div>
              <div>
                <span className="text-slate-500">Mem </span>
                <span className="text-slate-300 font-medium">
                  {fmt(stats.memory_bytes)} / {fmt(stats.memory_limit_bytes)}
                </span>
                <span className="text-slate-500 ml-1">({stats.memory_percent}%)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ContainersPage() {
  const { data, loading, error, refresh } = useContainers(10000);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [logsContainer, setLogsContainer] = useState<ContainerInfo | null>(null);

  const containers =
    data?.containers.filter((c) => {
      const matchFilter =
        filter === "all" ||
        (filter === "running" && c.status === "running") ||
        (filter === "stopped" && c.status !== "running");
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.image.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    }) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {logsContainer && (
        <ContainerLogModal
          id={logsContainer.id}
          name={logsContainer.name}
          onClose={() => setLogsContainer(null)}
        />
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Containers</h1>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          {data && (
            <>
              <span className="text-emerald-400">{data.running} running</span>
              <span>/</span>
              <span>{data.total} total</span>
            </>
          )}
          <button onClick={refresh} disabled={loading} className="btn-ghost ml-2">
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Search by name or image…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-1">
          {(["all", "running", "stopped"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                filter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card divide-y divide-slate-700/50">
        {loading && !data ? (
          <p className="py-8 text-center text-slate-500 text-sm">Loading containers…</p>
        ) : error ? (
          <p className="py-8 text-center text-red-400 text-sm">{error}</p>
        ) : containers.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-sm">No containers found</p>
        ) : (
          containers.map((c) => (
            <ContainerRow key={c.id} container={c} onRefresh={refresh} onShowLogs={setLogsContainer} />
          ))
        )}
      </div>
    </div>
  );
}
