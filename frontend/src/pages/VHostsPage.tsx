import { useEffect, useState } from "react";
import {
  createVHost, deleteVHost, enableSSL, getVHostConfig,
  getVHosts, toggleVHost, updateVHostConfig,
} from "../api/vhosts";
import type { VHost } from "../api/vhosts";
import Spinner from "../components/ui/Spinner";

const TYPE_LABELS: Record<string, string> = { static: "Static", php: "PHP", proxy: "Proxy" };
const TYPE_COLORS: Record<string, string> = {
  static: "bg-slate-700 text-slate-300",
  php:    "bg-indigo-900/50 text-indigo-300",
  proxy:  "bg-amber-900/50 text-amber-300",
};

export default function VHostsPage() {
  const [vhosts, setVhosts] = useState<VHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ domain: "", vhost_type: "static", root_path: "", php_version: "8.3", proxy_pass: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Config editor
  const [editDomain, setEditDomain] = useState<string | null>(null);
  const [configText, setConfigText] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState("");

  // SSL panel
  const [sslDomain, setSslDomain] = useState<string | null>(null);
  const [sslLoading, setSslLoading] = useState(false);
  const [sslOutput, setSslOutput] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setVhosts(await getVHosts()); setError(""); }
    catch { setError("Failed to load vHosts. Make sure nginx is installed."); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateError("");
    try {
      const v = await createVHost(form);
      setVhosts(p => [...p, v]);
      setShowForm(false);
      setForm({ domain: "", vhost_type: "static", root_path: "", php_version: "8.3", proxy_pass: "" });
    } catch (err: unknown) {
      setCreateError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create vHost");
    } finally { setCreating(false); }
  }

  async function handleToggle(domain: string, enabled: boolean) {
    await toggleVHost(domain, !enabled);
    setVhosts(p => p.map(v => v.domain === domain ? { ...v, enabled: !enabled } : v));
  }

  async function handleDelete(domain: string) {
    if (!confirm(`Delete vHost '${domain}'?`)) return;
    await deleteVHost(domain);
    setVhosts(p => p.filter(v => v.domain !== domain));
  }

  async function openConfig(domain: string) {
    setEditDomain(domain); setConfigLoading(true); setConfigError("");
    try { setConfigText(await getVHostConfig(domain)); }
    catch { setConfigError("Failed to load config."); }
    finally { setConfigLoading(false); }
  }

  async function saveConfig() {
    if (!editDomain) return;
    setConfigSaving(true); setConfigError("");
    try {
      await updateVHostConfig(editDomain, configText);
      setEditDomain(null);
    } catch (err: unknown) {
      setConfigError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Save failed");
    } finally { setConfigSaving(false); }
  }

  async function handleSSL(domain: string) {
    setSslDomain(domain); setSslLoading(true); setSslOutput("");
    try {
      const r = await enableSSL(domain);
      setSslOutput(r.output);
      if (r.success) { setVhosts(p => p.map(v => v.domain === domain ? { ...v, ssl: true } : v)); }
    } finally { setSslLoading(false); }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Virtual Hosts</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage nginx virtual hosts for your domains.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary px-4 py-2 text-sm">
          {showForm ? "Cancel" : "+ New vHost"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card border border-indigo-500/30 bg-indigo-950/20 space-y-3">
          <h2 className="text-sm font-semibold text-indigo-300">New Virtual Host</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Domain</label>
                <input value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))}
                  placeholder="example.com" required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type</label>
                <select value={form.vhost_type} onChange={e => setForm(p => ({ ...p, vhost_type: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                  <option value="static">Static HTML</option>
                  <option value="php">PHP (FPM)</option>
                  <option value="proxy">Reverse Proxy</option>
                </select>
              </div>
              {form.vhost_type !== "proxy" && (
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Document Root</label>
                  <input value={form.root_path} onChange={e => setForm(p => ({ ...p, root_path: e.target.value }))}
                    placeholder="/var/www/example.com/public"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500" />
                </div>
              )}
              {form.vhost_type === "proxy" && (
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Proxy Pass URL</label>
                  <input value={form.proxy_pass} onChange={e => setForm(p => ({ ...p, proxy_pass: e.target.value }))}
                    placeholder="http://127.0.0.1:3000" required={form.vhost_type === "proxy"}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500" />
                </div>
              )}
              {form.vhost_type === "php" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">PHP Version</label>
                  <select value={form.php_version} onChange={e => setForm(p => ({ ...p, php_version: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    {["8.4", "8.3", "8.2", "8.1", "8.0", "7.4"].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              )}
            </div>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <button type="submit" disabled={creating} className="btn-primary px-4 py-2 text-sm">
              {creating ? <Spinner size="sm" /> : "Create"}
            </button>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? <div className="flex justify-center py-8"><Spinner /></div>
          : error ? <p className="text-sm text-red-400 py-4">{error}</p>
          : vhosts.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No virtual hosts configured yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                    <th className="pb-2 pr-4">Domain</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4 hidden md:table-cell">Root / Proxy</th>
                    <th className="pb-2 pr-4">SSL</th>
                    <th className="pb-2 pr-4">Active</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {vhosts.map(v => (
                    <tr key={v.domain} className="text-slate-300 hover:bg-slate-700/20">
                      <td className="py-2 pr-4 font-medium">{v.domain}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[v.vhost_type] ?? "bg-slate-700 text-slate-300"}`}>
                          {TYPE_LABELS[v.vhost_type] ?? v.vhost_type}
                        </span>
                      </td>
                      <td className="py-2 pr-4 hidden md:table-cell font-mono text-xs text-slate-500 max-w-xs truncate">
                        {v.vhost_type === "proxy" ? v.proxy_pass : v.root_path}
                      </td>
                      <td className="py-2 pr-4">
                        {v.ssl
                          ? <span className="text-emerald-400 text-xs">🔒 SSL</span>
                          : <button onClick={() => handleSSL(v.domain)} className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">Enable SSL</button>}
                      </td>
                      <td className="py-2 pr-4">
                        <button onClick={() => handleToggle(v.domain, v.enabled)}
                          className={`w-9 h-5 rounded-full transition-colors ${v.enabled ? "bg-indigo-600" : "bg-slate-600"}`}>
                          <span className={`block w-3.5 h-3.5 rounded-full bg-white mx-auto transition-transform ${v.enabled ? "translate-x-2" : "-translate-x-2"}`} />
                        </button>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex gap-3 justify-end">
                          <button onClick={() => openConfig(v.domain)} className="text-xs text-indigo-400 hover:text-indigo-300">Edit config</button>
                          <button onClick={() => handleDelete(v.domain)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Config editor modal */}
      {editDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl flex flex-col h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <p className="text-sm font-semibold text-slate-200">nginx config — {editDomain}</p>
              <button onClick={() => setEditDomain(null)} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
            </div>
            <div className="flex-1 min-h-0 p-4">
              {configLoading ? <div className="flex justify-center py-8"><Spinner /></div>
                : <textarea value={configText} onChange={e => setConfigText(e.target.value)}
                    className="w-full h-full bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none" />}
            </div>
            {configError && <p className="px-5 pb-2 text-xs text-red-400">{configError}</p>}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700 shrink-0">
              <button onClick={() => setEditDomain(null)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button onClick={saveConfig} disabled={configSaving} className="btn-primary px-4 py-2 text-sm">
                {configSaving ? <Spinner size="sm" /> : "Save & reload nginx"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SSL modal */}
      {sslDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <p className="text-sm font-semibold text-slate-200">Enable SSL — {sslDomain}</p>
              {!sslLoading && <button onClick={() => setSslDomain(null)} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>}
            </div>
            <div className="px-5 py-4">
              {sslLoading
                ? <div className="flex items-center gap-3 text-sm text-slate-400"><Spinner size="sm" /> Running certbot…</div>
                : <pre className="text-xs font-mono bg-slate-950 rounded-lg p-3 text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto">{sslOutput}</pre>}
            </div>
            {!sslLoading && (
              <div className="flex justify-end px-5 py-4 border-t border-slate-700">
                <button onClick={() => setSslDomain(null)} className="btn-secondary px-4 py-2 text-sm">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
