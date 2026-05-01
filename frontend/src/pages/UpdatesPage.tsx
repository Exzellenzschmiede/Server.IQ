import { useEffect, useState } from "react";
import { fetchUpdates, getUpdates, runUpgrade } from "../api/updates";
import Spinner from "../components/ui/Spinner";
import type { PendingUpdate } from "../types/updates";

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<PendingUpdate[]>([]);
  const [count, setCount] = useState(0);
  const [aptAvailable, setAptAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState<"fetch" | "upgrade" | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getUpdates();
      setUpdates(data.updates);
      setCount(data.count);
      setAptAvailable(data.apt_available);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 8000);
  }

  async function doFetch() {
    setRunning("fetch");
    setOutput("");
    try {
      const r = await fetchUpdates();
      setOutput(r.output);
      flash(r.success ? "Package lists updated" : "Update failed", r.success);
      if (r.success) await load();
    } catch {
      flash("Error running apt-get update", false);
    } finally {
      setRunning(null);
    }
  }

  async function doUpgrade() {
    if (!confirm(`Install ${count} update${count !== 1 ? "s" : ""}? This may take several minutes.`)) return;
    setRunning("upgrade");
    setOutput("");
    try {
      const r = await runUpgrade();
      setOutput(r.output);
      flash(r.success ? "Upgrade complete" : "Upgrade failed", r.success);
      if (r.success) await load();
    } catch {
      flash("Error running upgrade", false);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">System Updates</h1>
        {!aptAvailable && <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">apt not available</span>}
      </div>

      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-slate-300">
              {loading ? "Checking…" : count === 0 ? "System is up to date" : `${count} update${count !== 1 ? "s" : ""} available`}
            </p>
            {msg && (
              <p className={`text-xs mt-1 ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>
                {msg.ok ? "✓" : "✗"} {msg.text}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={doFetch}
              disabled={!aptAvailable || running !== null}
              className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-50"
            >
              {running === "fetch" ? <Spinner size="sm" /> : "Refresh list"}
            </button>
            <button
              onClick={doUpgrade}
              disabled={!aptAvailable || count === 0 || running !== null}
              className="btn-primary py-1.5 px-3 text-sm disabled:opacity-50"
            >
              {running === "upgrade" ? <Spinner size="sm" /> : `Upgrade all (${count})`}
            </button>
          </div>
        </div>
      </div>

      {updates.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-4 font-medium">Package</th>
                <th className="pb-2 pr-4 font-medium">Current</th>
                <th className="pb-2 pr-4 font-medium">Available</th>
                <th className="pb-2 font-medium">Arch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {updates.map((u) => (
                <tr key={u.package} className="text-slate-300">
                  <td className="py-1.5 pr-4 font-medium">{u.package}</td>
                  <td className="py-1.5 pr-4 font-mono text-xs text-slate-500">{u.current_version}</td>
                  <td className="py-1.5 pr-4 font-mono text-xs text-emerald-400">{u.new_version}</td>
                  <td className="py-1.5 text-xs text-slate-500">{u.architecture}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {output && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Command output:</p>
          <pre className="bg-slate-950 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-auto max-h-64 border border-slate-700/50 whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
