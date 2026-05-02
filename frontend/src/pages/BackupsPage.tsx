import { useEffect, useState } from "react";
import { createBackup, deleteBackup, getDownloadUrl, listBackups } from "../api/backups";
import type { Backup } from "../api/backups";
import { listConnections } from "../api/databases";
import type { DBConnection } from "../api/databases";
import Spinner from "../components/ui/Spinner";

const PRESET_PATHS = [
  { label: "/etc", value: "/etc" },
  { label: "/var/www", value: "/var/www" },
  { label: "/home", value: "/home" },
  { label: "/opt", value: "/opt" },
  { label: "/root", value: "/root" },
];

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "completed" ? "text-emerald-400" : status === "failed" ? "text-red-400" : "text-amber-400";
  const icon = status === "completed" ? "✓" : status === "failed" ? "✗" : "⟳";
  return <span className={`text-xs font-medium ${cls}`}>{icon} {status}</span>;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [connections, setConnections] = useState<DBConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [paths, setPaths] = useState<string[]>(["/etc", "/var/www"]);
  const [customPath, setCustomPath] = useState("");
  const [includeDb, setIncludeDb] = useState(false);
  const [dbConnId, setDbConnId] = useState<number | null>(null);
  const [dbName, setDbName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    Promise.all([listBackups(), listConnections()])
      .then(([b, c]) => { setBackups(b); setConnections(c); })
      .finally(() => setLoading(false));
  }, []);

  function togglePath(p: string) {
    setPaths(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setCreating(true); setCreateError("");
    const allPaths = customPath.trim() ? [...paths, customPath.trim()] : paths;
    try {
      const b = await createBackup({
        name, include_paths: allPaths,
        db_connection_id: includeDb ? dbConnId : null,
        db_name: includeDb && dbName ? dbName : null,
      });
      setBackups(p => [b, ...p]);
      setShowForm(false); setName(""); setCustomPath(""); setIncludeDb(false);
    } catch (err: unknown) {
      setCreateError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Backup failed");
    } finally { setCreating(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this backup?")) return;
    await deleteBackup(id);
    setBackups(p => p.filter(b => b.id !== id));
  }

  async function handleRefresh() {
    const b = await listBackups();
    setBackups(b);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Backups</h1>
          <p className="text-xs text-slate-500 mt-0.5">Create and manage server backups stored in <code className="text-slate-400">/var/backups/server-iq/</code>.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="btn-ghost px-3 py-2 text-sm">↻</button>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary px-4 py-2 text-sm">
            {showForm ? "Cancel" : "+ New Backup"}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card border border-indigo-500/30 bg-indigo-950/20 space-y-4">
          <h2 className="text-sm font-semibold text-indigo-300">New Backup</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Backup name</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="weekly-backup"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">Include paths</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_PATHS.map(p => (
                  <button key={p.value} type="button" onClick={() => togglePath(p.value)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${paths.includes(p.value) ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300" : "border-slate-600 text-slate-400 hover:border-slate-500"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={customPath} onChange={e => setCustomPath(e.target.value)} placeholder="/custom/path"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500" />
                <span className="text-xs text-slate-500 self-center">custom path</span>
              </div>
              {paths.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">Selected: {paths.join(", ")}{customPath ? `, ${customPath}` : ""}</p>
              )}
            </div>

            {connections.length > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={includeDb} onChange={e => setIncludeDb(e.target.checked)} className="accent-indigo-500" />
                  Include database dump
                </label>
                {includeDb && (
                  <div className="grid grid-cols-2 gap-2 pl-5">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Connection</label>
                      <select value={dbConnId ?? ""} onChange={e => setDbConnId(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500">
                        <option value="">— Select —</option>
                        {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Database (empty = all)</label>
                      <input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="all"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <button type="submit" disabled={creating || paths.length === 0} className="btn-primary px-4 py-2 text-sm disabled:opacity-40">
              {creating ? <><Spinner size="sm" /> Starting backup…</> : "Start Backup"}
            </button>
          </form>
        </div>
      )}

      {/* Backups list */}
      <div className="card">
        {loading ? <div className="flex justify-center py-8"><Spinner /></div>
          : backups.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No backups yet. Create your first backup above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Created</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Size</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {backups.map(b => (
                    <tr key={b.id} className="text-slate-300 hover:bg-slate-700/20">
                      <td className="py-2 pr-4 font-medium">{b.name}</td>
                      <td className="py-2 pr-4 text-xs text-slate-400">{new Date(b.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-xs text-slate-400">{b.backup_type}</td>
                      <td className="py-2 pr-4 text-xs text-slate-400">{b.size_bytes > 0 ? fmt(b.size_bytes) : "—"}</td>
                      <td className="py-2 pr-4"><StatusBadge status={b.status} /></td>
                      <td className="py-2">
                        <div className="flex gap-3 justify-end">
                          {b.status === "completed" && (
                            <a href={getDownloadUrl(b.id)} className="text-xs text-indigo-400 hover:text-indigo-300" download>
                              Download
                            </a>
                          )}
                          {b.error && <span className="text-xs text-red-400 truncate max-w-xs" title={b.error}>Error</span>}
                          <button onClick={() => handleDelete(b.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
