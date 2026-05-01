import { useEffect, useState } from "react";
import {
  deleteNginxConfig,
  disableSite,
  enableSite,
  getNginxConfig,
  getNginxSites,
  getNginxStatus,
  reloadNginx,
  restartNginx,
  saveNginxConfig,
  testNginxConfig,
} from "../api/nginx";
import { useAuth } from "../auth/AuthContext";
import type { NginxActionResult, NginxSite, NginxStatus, NginxTestResult } from "../types/nginx";

type Action = "reload" | "restart" | "test" | null;

function SiteRow({
  site,
  isAdmin,
  onSelect,
  onToggle,
  onDelete,
}: {
  site: NginxSite;
  isAdmin: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="py-2.5 px-1 flex items-center justify-between gap-3 flex-wrap">
      <button onClick={onSelect} className="text-left min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{site.name}</p>
        <p className="text-xs text-slate-500 truncate">{site.path}</p>
      </button>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          site.enabled
            ? "bg-emerald-600/20 text-emerald-400"
            : "bg-slate-700/50 text-slate-500"
        }`}>
          {site.enabled ? "enabled" : "disabled"}
        </span>
        {isAdmin && (
          <>
            <button
              onClick={onToggle}
              className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-2 py-0.5 transition-colors"
            >
              {site.enabled ? "Disable" : "Enable"}
            </button>
            <button
              onClick={onSelect}
              className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-2 py-0.5 transition-colors"
            >
              Edit
            </button>
            {!site.is_default && (
              <button
                onClick={onDelete}
                className="text-xs text-red-400 hover:text-red-300 border border-red-800/50 rounded px-2 py-0.5 transition-colors"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function NginxPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const [status, setStatus] = useState<NginxStatus | null>(null);
  const [sites, setSites] = useState<NginxSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<Action>(null);
  const [actionMsg, setActionMsg] = useState<NginxActionResult | NginxTestResult | null>(null);
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newSiteName, setNewSiteName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, sl] = await Promise.all([getNginxStatus(), getNginxSites()]);
      setStatus(s);
      setSites(sl.sites);
    } catch {
      setStatus({ available: false, version: null, running: false, config_test_ok: null });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function flash(msg: NginxActionResult | NginxTestResult) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 5000);
  }

  async function doAction(a: Action) {
    if (!a || a === "test") {
      setAction("test");
      try {
        const r = await testNginxConfig();
        flash(r);
      } catch { flash({ ok: false, message: "Error" } as NginxActionResult); }
      setAction(null);
      return;
    }
    setAction(a);
    try {
      const r = a === "reload" ? await reloadNginx() : await restartNginx();
      flash(r);
      await load();
    } catch { flash({ ok: false, message: "Error" } as NginxActionResult); }
    setAction(null);
  }

  async function openEdit(name: string) {
    setEditMsg(null);
    try {
      const cfg = await getNginxConfig(name);
      setEditContent(cfg.content);
      setEditingSite(name);
    } catch { /* show error */ }
  }

  async function saveEdit() {
    if (!editingSite) return;
    setEditSaving(true);
    setEditMsg(null);
    try {
      await saveNginxConfig(editingSite, editContent);
      setEditMsg("Saved");
      await load();
    } catch {
      setEditMsg("Error saving");
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleSite(site: NginxSite) {
    try {
      if (site.enabled) await disableSite(site.name);
      else await enableSite(site.name);
      await load();
    } catch { /* noop */ }
  }

  async function doDelete(name: string) {
    try {
      await deleteNginxConfig(name);
      setConfirmDelete(null);
      await load();
    } catch { /* noop */ }
  }

  async function createNew() {
    if (!newSiteName.trim()) return;
    const template = `server {\n    listen 80;\n    server_name example.com;\n\n    location / {\n        proxy_pass http://127.0.0.1:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n    }\n}\n`;
    await saveNginxConfig(newSiteName.trim(), template);
    setShowNewForm(false);
    setNewSiteName("");
    await load();
    await openEdit(newSiteName.trim());
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  if (!status?.available) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-2xl">
        <h1 className="text-xl font-bold">Nginx</h1>
        <div className="card py-12 text-center space-y-2">
          <p className="text-2xl">🛑</p>
          <p className="text-slate-400 text-sm">nginx is not installed or not accessible on this system.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="card max-w-sm w-full space-y-4">
            <h3 className="font-semibold">Delete {confirmDelete}?</h3>
            <p className="text-sm text-slate-400">This will remove the config file and disable the site.</p>
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => doDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Config editor modal */}
      {editingSite && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <span className="font-semibold text-slate-200">{editingSite}</span>
              <button onClick={() => setEditingSite(null)} className="text-slate-400 hover:text-slate-200 text-lg">✕</button>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 bg-slate-950 font-mono text-xs text-slate-300 p-4 resize-none focus:outline-none min-h-0"
              spellCheck={false}
            />
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-700">
              {editMsg && (
                <span className={`text-xs ${editMsg === "Saved" ? "text-emerald-400" : "text-red-400"}`}>
                  {editMsg}
                </span>
              )}
              <div className="flex gap-2 ml-auto">
                <button className="btn-ghost" onClick={() => setEditingSite(null)}>Cancel</button>
                <button className="btn-primary" disabled={editSaving} onClick={saveEdit}>
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Nginx</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => doAction("test")} disabled={!!action} className="btn-ghost">
              {action === "test" ? "Testing…" : "Test config"}
            </button>
            <button onClick={() => doAction("reload")} disabled={!!action} className="btn-ghost">
              {action === "reload" ? "Reloading…" : "Reload"}
            </button>
            <button onClick={() => doAction("restart")} disabled={!!action} className="btn-ghost">
              {action === "restart" ? "Restarting…" : "Restart"}
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="card flex items-center gap-6 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status.running ? "bg-emerald-400" : "bg-red-400"}`} />
          <span className="text-slate-300">{status.running ? "Running" : "Stopped"}</span>
        </div>
        {status.version && <span className="text-slate-500">v{status.version}</span>}
        {status.config_test_ok !== null && (
          <span className={status.config_test_ok ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>
            Config {status.config_test_ok ? "✓ OK" : "✗ Error"}
          </span>
        )}
      </div>

      {actionMsg && (
        <div className={`card text-sm border ${"ok" in actionMsg && actionMsg.ok ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-300" : "bg-red-600/10 border-red-500/30 text-red-400"}`}>
          {"output" in actionMsg ? actionMsg.output : actionMsg.message}
        </div>
      )}

      {/* Sites */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">Virtual Hosts</h2>
        {isAdmin && (
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            + New site
          </button>
        )}
      </div>

      {showNewForm && (
        <div className="card flex items-center gap-2">
          <input
            value={newSiteName}
            onChange={(e) => setNewSiteName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createNew(); }}
            placeholder="site-name (e.g. myapp.conf)"
            className="flex-1 bg-slate-700 text-sm text-slate-200 rounded px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-indigo-500"
          />
          <button className="btn-primary" onClick={createNew} disabled={!newSiteName.trim()}>
            Create
          </button>
          <button className="btn-ghost" onClick={() => setShowNewForm(false)}>Cancel</button>
        </div>
      )}

      <div className="card divide-y divide-slate-700/50">
        {sites.length === 0 ? (
          <p className="py-6 text-center text-slate-500 text-sm">No sites found in sites-available</p>
        ) : (
          sites.map((site) => (
            <SiteRow
              key={site.name}
              site={site}
              isAdmin={isAdmin}
              onSelect={() => openEdit(site.name)}
              onToggle={() => toggleSite(site)}
              onDelete={() => setConfirmDelete(site.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}
