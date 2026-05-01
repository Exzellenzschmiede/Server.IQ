import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getContainerStats } from "../api/docker";
import ContainerActions from "../components/containers/ContainerActions";
import StatusBadge from "../components/ui/StatusBadge";
import { useContainers } from "../hooks/useContainers";
import type { ContainerInfo, ContainerStats } from "../types/docker";

type Filter = "all" | "running" | "stopped";

function fmt(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + " GB";
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(0) + " MB";
  return (bytes / 1024).toFixed(0) + " KB";
}

function ContainerCard({
  container,
  onRefresh,
}: {
  container: ContainerInfo;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<ContainerStats | null>(null);

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
      } catch {
        /* container might have stopped */
      }
    };
    fetch();
    const t = setInterval(fetch, 5000);
    return () => { active = false; clearInterval(t); };
  }, [expanded, container.id, container.status]);

  const boundPorts = container.ports.filter((p) => p.host_port);

  return (
    <div className="card">
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{container.name}</span>
            <StatusBadge status={container.status} />
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">{container.image}</p>
          {container.status_text && container.status_text !== container.status && (
            <p className="text-xs text-slate-600 mt-0.5">{container.status_text}</p>
          )}
        </div>
        <span className="text-slate-500 text-sm flex-shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-slate-700/50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400">
            <div>
              <span className="text-slate-500">ID: </span>
              {container.short_id}
            </div>

            {boundPorts.length > 0 && (
              <div>
                <span className="text-slate-500">Ports: </span>
                {boundPorts.map((p) => `${p.host_port}→${p.container_port}`).join(", ")}
              </div>
            )}

            {container.networks.length > 0 && (
              <div>
                <span className="text-slate-500">Network: </span>
                {container.networks.join(", ")}
              </div>
            )}

            {container.restart_policy && (
              <div>
                <span className="text-slate-500">Restart: </span>
                {container.restart_policy}
              </div>
            )}

            {container.started_at && (
              <div>
                <span className="text-slate-500">Started: </span>
                {new Date(container.started_at).toLocaleString()}
              </div>
            )}
          </div>

          {container.volumes.length > 0 && (
            <div className="text-xs text-slate-400 space-y-0.5">
              <p className="text-slate-500 font-medium">Volumes</p>
              {container.volumes.map((v, i) => (
                <p key={i} className="font-mono text-slate-500 truncate">{v}</p>
              ))}
            </div>
          )}

          {stats && (
            <div className="flex gap-4 text-xs bg-slate-900/60 rounded-lg px-3 py-2">
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

          <ContainerActions
            container={container}
            onRefresh={onRefresh}
            onViewLogs={() => navigate(`/containers/${container.id}/logs`)}
          />
        </div>
      )}
    </div>
  );
}

export default function ContainersPage() {
  const { data, loading, error, refresh } = useContainers(10000);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Container</h1>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          {data && (
            <>
              <span className="text-emerald-400">{data.running} running</span>
              <span>/</span>
              <span>{data.total} total</span>
            </>
          )}
          <button onClick={refresh} className="btn-ghost ml-2">
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

      {loading && !data ? (
        <p className="text-center text-slate-500 py-10 text-sm">Loading containers…</p>
      ) : error ? (
        <p className="text-center text-red-400 py-10 text-sm">{error}</p>
      ) : containers.length === 0 ? (
        <p className="text-center text-slate-500 py-10 text-sm">No containers found</p>
      ) : (
        <div className="space-y-3">
          {containers.map((c) => (
            <ContainerCard key={c.id} container={c} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
