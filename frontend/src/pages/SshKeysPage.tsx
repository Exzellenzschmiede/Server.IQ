import { useEffect, useRef, useState } from "react";
import { addSshKey, deleteSshKey, getSshKeys } from "../api/sshKeys";
import type { SshKey } from "../api/sshKeys";

export default function SshKeysPage() {
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setKeys(await getSshKeys());
    } catch {
      setError("Could not load SSH keys.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      await addSshKey(newKey.trim());
      setNewKey("");
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to add key.";
      setAddError(detail);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(index: number) {
    if (!confirm("Remove this SSH key? You may lose access if it is your only key.")) return;
    setDeleting(index);
    try {
      await deleteSshKey(index);
      await load();
    } catch {
      setError("Failed to delete key.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">SSH Keys</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage authorized public keys (~/.ssh/authorized_keys)</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost">Refresh</button>
      </div>

      {error && (
        <div className="card bg-red-600/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {/* Key list */}
      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">Authorized Keys ({keys.length})</h2>
        {loading ? (
          <p className="text-sm text-slate-500 py-2">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-slate-500">No authorized keys found.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.index} className="flex items-start justify-between gap-3 bg-slate-900 rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-sky-400 shrink-0">{k.type}</span>
                    {k.comment && (
                      <span className="text-xs text-slate-300 truncate">{k.comment}</span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-slate-600 mt-0.5 truncate">{k.fingerprint}</p>
                </div>
                <button
                  onClick={() => handleDelete(k.index)}
                  disabled={deleting === k.index}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors shrink-0"
                >
                  {deleting === k.index ? "…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add key */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Add Public Key</h2>
        <form onSubmit={handleAdd} className="space-y-2">
          <textarea
            ref={textareaRef}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="ssh-ed25519 AAAA… user@host"
            rows={3}
            spellCheck={false}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-y"
          />
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <button
            type="submit"
            disabled={adding || !newKey.trim()}
            className="btn-primary py-1.5 px-4"
          >
            {adding ? "Adding…" : "Add Key"}
          </button>
        </form>
      </div>
    </div>
  );
}
