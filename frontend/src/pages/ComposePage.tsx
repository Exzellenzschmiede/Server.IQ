import { useEffect, useState } from "react";
import { composeAction, listComposeProjects } from "../api/compose";
import Spinner from "../components/ui/Spinner";
import type { ComposeProject } from "../types/compose";

type Action = "up" | "down" | "pull" | "restart" | "stop";

function statusBadge(status: ComposeProject["status"]) {
  const map = {
    running: "bg-emerald-500/20 text-emerald-400",
    partial: "bg-yellow-500/20 text-yellow-400",
    stopped: "bg-slate-600/40 text-slate-400",
    unknown: "bg-slate-700/40 text-slate-500",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>
      {status}
    </span>
  );
}

export default function ComposePage() {
  const [projects, setProjects] = useState<ComposeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<{ project: string; text: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setProjects(await listComposeProjects());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAction(project: ComposeProject, action: Action) {
    const key = `${project.name}:${action}`;
    setRunning(key);
    setOutput(null);
    try {
      const r = await composeAction(project.file, action);
      setOutput({ project: project.name, text: r.output, ok: r.success });
      if (action !== "pull") await load();
    } catch {
      setOutput({ project: project.name, text: "Request failed", ok: false });
    } finally {
      setRunning(null);
    }
  }

  function ActionBtn({ project, action, label, danger = false }: { project: ComposeProject; action: Action; label: string; danger?: boolean }) {
    const key = `${project.name}:${action}`;
    const busy = running === key;
    return (
      <button
        onClick={() => handleAction(project, action)}
        disabled={running !== null}
        className={`text-xs px-2.5 py-1 rounded transition-colors disabled:opacity-40 ${
          danger
            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
        }`}
      >
        {busy ? <Spinner size="sm" /> : label}
      </button>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Docker Compose</h1>
        <button onClick={load} className="btn-secondary py-1.5 px-3 text-sm">Refresh</button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Scanning for compose files…</p>
      ) : projects.length === 0 ? (
        <div className="card">
          <p className="text-sm text-slate-500">
            No docker-compose.yml files found in /opt, /srv, /home, /root, /var/lib.
          </p>
        </div>
      ) : (
        projects.map((p) => (
          <div key={p.file} className="card space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm">{p.name}</h2>
                  {statusBadge(p.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{p.path}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ActionBtn project={p} action="up" label="Up" />
                <ActionBtn project={p} action="pull" label="Pull" />
                <ActionBtn project={p} action="restart" label="Restart" />
                <ActionBtn project={p} action="stop" label="Stop" danger />
                <ActionBtn project={p} action="down" label="Down" danger />
              </div>
            </div>

            {p.services.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {p.services.map((s) => (
                  <span key={s} className="text-xs bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            )}

            {output?.project === p.name && (
              <div>
                <p className={`text-xs mb-1 ${output.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {output.ok ? "✓ Success" : "✗ Failed"}
                </p>
                {output.text && (
                  <pre className="bg-slate-950 rounded p-2 text-xs font-mono text-slate-300 overflow-auto max-h-40 whitespace-pre-wrap border border-slate-700/50">
                    {output.text}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
