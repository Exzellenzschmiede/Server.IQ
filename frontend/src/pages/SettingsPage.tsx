import { useEffect, useState } from "react";
import {
  createMonitoredService,
  deleteMonitoredService,
  getAppConfig,
  getMonitoredServices,
  updateAppConfig,
  updateMonitoredService,
} from "../api/settings";
import { PROVIDER_MODELS } from "../api/ai";
import Spinner from "../components/ui/Spinner";
import type { AppConfig, ServiceConfig, ServiceConfigCreate } from "../types/settings";

const EMPTY_FORM: ServiceConfigCreate = {
  key: "",
  display_name: "",
  host: "",
  port: null,
  enabled: true,
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (ChatGPT)",
  mistral: "Mistral",
  gemini: "Google Gemini",
};

export default function SettingsPage() {
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<ServiceConfigCreate>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // AI settings
  const [aiProvider, setAiProvider] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    load();
    getAppConfig().then((cfg) => {
      setAiProvider(cfg.ai_provider ?? "");
      setAiModel(cfg.ai_model ?? "");
      setAiApiKey(cfg.ai_api_key ?? "");
    });
  }, []);

  async function load() {
    setLoadError("");
    try {
      setServices(await getMonitoredServices());
    } catch {
      setLoadError("Could not load services.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(svc: ServiceConfig) {
    setEditId(svc.id);
    setForm({ key: svc.key, display_name: svc.display_name, host: svc.host ?? "", port: svc.port, enabled: svc.enabled });
    setError("");
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body: ServiceConfigCreate = {
      ...form,
      host: form.host?.trim() || null,
      port: form.port ? Number(form.port) : null,
    };
    try {
      if (editId !== null) {
        const updated = await updateMonitoredService(editId, body);
        setServices((prev) => prev.map((s) => (s.id === editId ? updated : s)));
      } else {
        const created = await createMonitoredService(body);
        setServices((prev) => [...prev, created]);
      }
      cancelEdit();
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(svc: ServiceConfig) {
    const updated = await updateMonitoredService(svc.id, { enabled: !svc.enabled });
    setServices((prev) => prev.map((s) => (s.id === svc.id ? updated : s)));
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this service?")) return;
    await deleteMonitoredService(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editId === id) cancelEdit();
  }

  async function handleAiSave(e: React.FormEvent) {
    e.preventDefault();
    setAiSaving(true);
    setAiMsg(null);
    try {
      await updateAppConfig({
        ai_provider: aiProvider || null,
        ai_model: aiModel || null,
        ai_api_key: aiApiKey || null,
      } as Partial<AppConfig>);
      setAiMsg({ text: "AI settings saved.", ok: true });
    } catch {
      setAiMsg({ text: "Failed to save AI settings.", ok: false });
    } finally {
      setAiSaving(false);
      setTimeout(() => setAiMsg(null), 3000);
    }
  }

  function handleProviderChange(provider: string) {
    setAiProvider(provider);
    const models = PROVIDER_MODELS[provider] ?? [];
    setAiModel(models[0] ?? "");
  }

  const availableModels = PROVIDER_MODELS[aiProvider] ?? [];

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* ── AI Settings ──────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-1">AI Integration</h2>
        <p className="text-xs text-slate-500 mb-4">
          Configure an AI provider to enable the Server Assistant, Log Analyzer, and Cron Helper.
          Leave blank to disable AI features.
        </p>
        <form onSubmit={handleAiSave} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">— Disabled —</option>
                {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Model</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                disabled={!aiProvider}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-40"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {availableModels.length === 0 && <option value="">—</option>}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">API Key</label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                disabled={!aiProvider}
                placeholder={aiProvider ? "sk-…" : "Select a provider first"}
                autoComplete="off"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-40"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={aiSaving} className="btn-primary py-1.5 px-4">
              {aiSaving ? <Spinner size="sm" /> : "Save AI settings"}
            </button>
            {aiMsg && (
              <span className={`text-xs ${aiMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                {aiMsg.text}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ── Monitored Services ───────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Monitored Services</h2>
        {loading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : loadError ? (
          <p className="text-sm text-red-400 py-2">{loadError}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                  <th className="pb-2 pr-4">Display Name</th>
                  <th className="pb-2 pr-4">Key</th>
                  <th className="pb-2 pr-4">Host:Port</th>
                  <th className="pb-2 pr-4">Active</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {services.map((svc) => (
                  <tr key={svc.id} className="text-slate-300">
                    <td className="py-2 pr-4 font-medium">{svc.display_name}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-400">{svc.key}</td>
                    <td className="py-2 pr-4 text-slate-400 text-xs">
                      {svc.host ? `${svc.host}:${svc.port}` : "Socket"}
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => handleToggle(svc)}
                        className={`w-9 h-5 rounded-full transition-colors ${svc.enabled ? "bg-indigo-600" : "bg-slate-600"}`}
                      >
                        <span className={`block w-3.5 h-3.5 rounded-full bg-white mx-auto transition-transform ${svc.enabled ? "translate-x-2" : "-translate-x-2"}`} />
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(svc)} className="text-xs text-indigo-400 hover:text-indigo-300">Edit</button>
                        <button onClick={() => handleDelete(svc.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-slate-500">No services</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Service form ───────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          {editId !== null ? "Edit Service" : "Add Service"}
        </h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Display Name</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Key (unique)</label>
              <input
                value={form.key}
                onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
                required
                disabled={editId !== null}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Host (empty = socket check)</label>
              <input
                value={form.host ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                placeholder="127.0.0.1"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Port</label>
              <input
                type="number"
                value={form.port ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, port: e.target.value ? Number(e.target.value) : null }))}
                min={1}
                max={65535}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary py-1.5 px-4">
              {saving ? <Spinner size="sm" /> : editId !== null ? "Save" : "Add"}
            </button>
            {editId !== null && (
              <button type="button" onClick={cancelEdit} className="btn-secondary py-1.5 px-4">Cancel</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
