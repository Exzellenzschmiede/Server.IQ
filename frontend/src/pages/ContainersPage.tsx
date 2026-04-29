import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ContainerActions from "../components/containers/ContainerActions";
import StatusBadge from "../components/ui/StatusBadge";
import { useContainers } from "../hooks/useContainers";
import type { ContainerInfo } from "../types/docker";

type Filter = "all" | "running" | "stopped";

function ContainerCard({
  container,
  onRefresh,
}: {
  container: ContainerInfo;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

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
        </div>
        <span className="text-slate-500 text-sm flex-shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-slate-700/50">
          <div className="text-xs text-slate-400 space-y-1">
            <p>
              <span className="text-slate-500">ID: </span>
              {container.short_id}
            </p>
            {container.ports.length > 0 && (
              <p>
                <span className="text-slate-500">Ports: </span>
                {container.ports
                  .filter((p) => p.host_port)
                  .map((p) => `${p.host_port}→${p.container_port}`)
                  .join(", ") || "—"}
              </p>
            )}
            {container.started_at && (
              <p>
                <span className="text-slate-500">Started: </span>
                {new Date(container.started_at).toLocaleString()}
              </p>
            )}
          </div>
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
        <h1 className="text-xl font-bold">Containers</h1>
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
