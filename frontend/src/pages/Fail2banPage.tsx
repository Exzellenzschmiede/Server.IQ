import { useEffect, useState } from "react";
import { getFail2banStatus, unbanIp } from "../api/fail2ban";
import type { Fail2banJail } from "../types/fail2ban";

export default function Fail2banPage() {
  const [available, setAvailable] = useState(true);
  const [active, setActive] = useState(false);
  const [jails, setJails] = useState<Fail2banJail[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanning, setUnbanning] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getFail2banStatus();
      setAvailable(data.available);
      setActive(data.active);
      setJails(data.jails);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 6000);
  }

  async function handleUnban(jail: string, ip: string) {
    const key = `${jail}:${ip}`;
    setUnbanning(key);
    try {
      const r = await unbanIp(jail, ip);
      flash(r.message, r.success);
      if (r.success) await load();
    } catch {
      flash("Error unbanning IP", false);
    } finally {
      setUnbanning(null);
    }
  }

  const totalBanned = jails.reduce((sum, j) => sum + j.currently_banned, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Fail2ban</h1>
        <button onClick={load} className="btn-secondary py-1.5 px-3 text-sm">Refresh</button>
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>
          {msg.ok ? "✓" : "✗"} {msg.text}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !available ? (
        <div className="card">
          <p className="text-sm text-yellow-400">fail2ban is not installed on this system.</p>
        </div>
      ) : !active ? (
        <div className="card">
          <p className="text-sm text-yellow-400">fail2ban is installed but not running.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="card text-center">
              <p className="text-2xl font-bold text-indigo-400">{jails.length}</p>
              <p className="text-xs text-slate-500 mt-1">Active jails</p>
            </div>
            <div className="card text-center">
              <p className={`text-2xl font-bold ${totalBanned > 0 ? "text-red-400" : "text-emerald-400"}`}>{totalBanned}</p>
              <p className="text-xs text-slate-500 mt-1">Currently banned</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-slate-300">
                {jails.reduce((s, j) => s + j.total_failed, 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total failed</p>
            </div>
          </div>

          {jails.map((jail) => (
            <div key={jail.name} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-slate-200">{jail.name}</h2>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>Failed: <span className="text-slate-200">{jail.currently_failed}</span></span>
                  <span>Banned: <span className={jail.currently_banned > 0 ? "text-red-400" : "text-emerald-400"}>{jail.currently_banned}</span></span>
                </div>
              </div>
              {jail.banned_ips.length > 0 ? (
                <div className="space-y-1">
                  {jail.banned_ips.map((ip) => {
                    const key = `${jail.name}:${ip}`;
                    return (
                      <div key={ip} className="flex items-center justify-between bg-slate-900/50 rounded px-3 py-1.5">
                        <span className="font-mono text-xs text-red-300">{ip}</span>
                        <button
                          onClick={() => handleUnban(jail.name, ip)}
                          disabled={unbanning === key}
                          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                        >
                          {unbanning === key ? "Unbanning…" : "Unban"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No banned IPs</p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
