import { useEffect, useState } from "react";
import { getAccessLog } from "../api/access_log";
import type { NginxLogEntry, SshLogEntry } from "../types/access_log";

type Tab = "ssh" | "nginx";

function eventColor(event: string) {
  if (event === "accepted") return "text-emerald-400";
  if (event === "failed" || event === "invalid") return "text-red-400";
  if (event === "disconnect") return "text-slate-400";
  return "text-slate-300";
}

function statusColor(status: number) {
  if (status < 300) return "text-emerald-400";
  if (status < 400) return "text-sky-400";
  if (status < 500) return "text-yellow-400";
  return "text-red-400";
}

export default function AccessLogPage() {
  const [tab, setTab] = useState<Tab>("ssh");
  const [ssh, setSsh] = useState<SshLogEntry[]>([]);
  const [nginx, setNginx] = useState<NginxLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await getAccessLog(500);
      setSsh(data.ssh);
      setNginx(data.nginx);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredSsh = filter
    ? ssh.filter((e) => [e.source_ip, e.user, e.event].some((v) => v?.toLowerCase().includes(filter.toLowerCase())))
    : ssh;

  const filteredNginx = filter
    ? nginx.filter((e) => [e.source_ip, e.path, String(e.status)].some((v) => v.toLowerCase().includes(filter.toLowerCase())))
    : nginx;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Access Log</h1>
        <div className="flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by IP, user, path…"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 w-52"
          />
          <button onClick={load} className="btn-secondary py-1.5 px-3 text-sm">Refresh</button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-700">
        {(["ssh", "nginx"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-indigo-500 text-indigo-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t === "ssh" ? `SSH (${filteredSsh.length})` : `nginx (${filteredNginx.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-4">Loading…</p>
      ) : tab === "ssh" ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-4 font-medium">Event</th>
                <th className="pb-2 pr-4 font-medium">User</th>
                <th className="pb-2 font-medium">Source IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {filteredSsh.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">No SSH log entries found</td></tr>
              ) : (
                filteredSsh.map((e, i) => (
                  <tr key={i} className="text-slate-300 hover:bg-slate-800/50">
                    <td className="py-1.5 pr-4 font-mono text-slate-500">{e.timestamp}</td>
                    <td className={`py-1.5 pr-4 font-semibold ${eventColor(e.event)}`}>{e.event}</td>
                    <td className="py-1.5 pr-4">{e.user ?? "—"}</td>
                    <td className="py-1.5 font-mono">{e.source_ip ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Method</th>
                <th className="pb-2 pr-4 font-medium">Path</th>
                <th className="pb-2 font-medium">Source IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {filteredNginx.length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-slate-500">No nginx log entries found</td></tr>
              ) : (
                filteredNginx.map((e, i) => (
                  <tr key={i} className="text-slate-300 hover:bg-slate-800/50">
                    <td className="py-1.5 pr-4 font-mono text-slate-500 whitespace-nowrap">{e.timestamp}</td>
                    <td className={`py-1.5 pr-3 font-bold ${statusColor(e.status)}`}>{e.status}</td>
                    <td className="py-1.5 pr-3 text-slate-400">{e.method}</td>
                    <td className="py-1.5 pr-4 max-w-xs truncate font-mono text-slate-300">{e.path}</td>
                    <td className="py-1.5 font-mono">{e.source_ip}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
