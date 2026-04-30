import { useEffect, useState } from "react";
import { addCronJob, deleteCronJob, getCronJobs } from "../api/cron";
import type { CronJob } from "../types/cron";

const PRESETS = [
  { label: "Täglich 2:00 Uhr", value: "0 2 * * *" },
  { label: "Stündlich",          value: "0 * * * *" },
  { label: "Alle 15 Minuten",    value: "*/15 * * * *" },
  { label: "Wöchentlich Mo 3:00",value: "0 3 * * 1" },
  { label: "Monatlich 1. 4:00",  value: "0 4 1 * *" },
];

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [schedule, setSchedule] = useState("");
  const [command, setCommand] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const r = await getCronJobs();
      setJobs(r.jobs);
      setError(null);
    } catch {
      setError("Crontab konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 4000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!schedule.trim() || !command.trim()) return;
    setBusy(true);
    try {
      await addCronJob(schedule.trim(), command.trim());
      flash("Job hinzugefügt");
      setSchedule("");
      setCommand("");
      await reload();
    } catch (err: unknown) {
      flash((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Fehler beim Hinzufügen");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(index: number) {
    setBusy(true);
    try {
      await deleteCronJob(index);
      flash("Job gelöscht");
      await reload();
    } catch {
      flash("Fehler beim Löschen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-xl font-bold">Cron Jobs</h1>
      <p className="text-sm text-slate-400">Crontab des aktuellen Benutzers (deploy)</p>

      {msg && (
        <div className="card bg-indigo-600/10 border border-indigo-500/30 text-indigo-300 text-sm">{msg}</div>
      )}

      {/* Add form */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Neuer Job</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setSchedule(p.value)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                schedule === p.value
                  ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                  : "border-slate-600 text-slate-400 hover:border-slate-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleAdd} className="space-y-2">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 w-48">
              <label className="text-xs text-slate-500">Schedule (cron expression)</label>
              <input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="* * * * *"
                className="bg-slate-700 text-sm font-mono text-slate-200 rounded px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-slate-500">Befehl</label>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="/opt/server-iq/backup.sh >> /var/log/backup.log 2>&1"
                className="bg-slate-700 text-sm font-mono text-slate-200 rounded px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-indigo-500 w-full"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || !schedule || !command}
            className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Hinzufügen
          </button>
        </form>
      </div>

      {/* Jobs list */}
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Aktuelle Jobs</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Lade…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-slate-500">Keine Cron Jobs definiert</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-4">Schedule</th>
                <th className="pb-2 pr-4">Befehl</th>
                <th className="pb-2 pr-4">Kommentar</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.index} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300 whitespace-nowrap">{job.schedule}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-300 max-w-xs truncate">{job.command}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{job.comment}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(job.index)}
                      disabled={busy}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
