import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getMetricsHistory, getServices, getSystemInfo, getTopProcesses } from "../api/system";
import GaugeChart from "../components/ui/GaugeChart";
import MetricCard from "../components/ui/MetricCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useMetrics } from "../hooks/useMetrics";
import type { MetricHistoryPoint, ProcessInfo } from "../types/system";
import type { ServicesResponse } from "../types/system";
import type { SystemInfo } from "../types/system";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatKBps(bytesPerSec: number): string {
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
}

function formatIORate(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { data, error } = useMetrics(5000);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [history, setHistory] = useState<MetricHistoryPoint[]>([]);
  const [services, setServices] = useState<ServicesResponse | null>(null);
  const [sortBy, setSortBy] = useState<"cpu" | "memory">("cpu");
  const [historyHours, setHistoryHours] = useState(2);

  useEffect(() => {
    getSystemInfo().then(setInfo).catch(() => {});
    getServices().then(setServices).catch(() => {});
  }, []);

  useEffect(() => {
    getTopProcesses(sortBy, 5).then(setProcesses).catch(() => {});
    const id = setInterval(() => getTopProcesses(sortBy, 5).then(setProcesses).catch(() => {}), 10000);
    return () => clearInterval(id);
  }, [sortBy]);

  useEffect(() => {
    getMetricsHistory(historyHours).then(setHistory).catch(() => {});
    const id = setInterval(() => getMetricsHistory(historyHours).then(setHistory).catch(() => {}), 60000);
    return () => clearInterval(id);
  }, [historyHours]);

  if (error) {
    return <div className="p-6 text-red-400">Failed to load metrics. Is the backend running?</div>;
  }

  const primaryDisk = data?.disk[0];
  const primaryNet = data?.network[0];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          {info && (
            <p className="text-sm text-slate-400">
              {info.hostname} · {info.os_name} · up {formatUptime(info.uptime_seconds)}
            </p>
          )}
        </div>
        <span className="text-xs text-slate-500">Refreshes every 5s</span>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GaugeChart value={data?.cpu.percent ?? 0} label="CPU" />
        <GaugeChart value={data?.memory.percent ?? 0} label="RAM" />
        <GaugeChart value={primaryDisk?.percent ?? 0} label="Disk" />
        <GaugeChart
          value={
            primaryNet
              ? Math.min((primaryNet.bytes_recv_per_sec + primaryNet.bytes_sent_per_sec) / 1024 / 10, 100)
              : 0
          }
          label="Network"
        />
      </div>

      {/* Metric cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          label="CPU"
          value={`${Math.round(data?.cpu.percent ?? 0)}%`}
          sub={`${data?.cpu.count ?? "—"} cores · ${data?.cpu.frequency_mhz?.toFixed(0) ?? "—"} MHz`}
          icon="🖥"
          color="indigo"
        />
        <MetricCard
          label="Memory"
          value={`${Math.round(data?.memory.percent ?? 0)}%`}
          sub={`${formatBytes(data?.memory.used_bytes ?? 0)} / ${formatBytes(data?.memory.total_bytes ?? 0)}`}
          icon="🧠"
          color="emerald"
        />
        {primaryDisk && (
          <MetricCard
            label={`Disk (${primaryDisk.mountpoint})`}
            value={`${Math.round(primaryDisk.percent)}%`}
            sub={`${formatBytes(primaryDisk.used_bytes)} / ${formatBytes(primaryDisk.total_bytes)}`}
            icon="💾"
            color="amber"
          />
        )}
        {primaryNet && (
          <MetricCard
            label={`Network (${primaryNet.name})`}
            value={`↓ ${formatKBps(primaryNet.bytes_recv_per_sec)}`}
            sub={`↑ ${formatKBps(primaryNet.bytes_sent_per_sec)}`}
            icon="🌐"
            color="rose"
          />
        )}
      </div>

      {/* Load average + extra stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Load Average</p>
          <div className="flex justify-around">
            {[
              { label: "1 min", val: data?.load_avg?.load_1 },
              { label: "5 min", val: data?.load_avg?.load_5 },
              { label: "15 min", val: data?.load_avg?.load_15 },
            ].map(({ label, val }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-slate-100">{val?.toFixed(2) ?? "—"}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Disk I/O</p>
          <div className="flex justify-around">
            <div className="text-center">
              <p className="text-lg font-bold text-sky-400">
                {data?.disk_io ? formatIORate(data.disk_io.read_bytes_per_sec) : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Read</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-violet-400">
                {data?.disk_io ? formatIORate(data.disk_io.write_bytes_per_sec) : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Write</p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">TCP Connections</p>
          <p className="text-4xl font-bold text-slate-100 text-center">{data?.tcp_connections ?? "—"}</p>
          <p className="text-xs text-slate-500 text-center mt-1">open connections</p>
        </div>
      </div>

      {/* Service status mini-grid */}
      {services && services.services.length > 0 && (
        <div className="card">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Services</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {services.services.map((s) => (
              <div key={s.name} className="flex items-center gap-2 bg-slate-700/30 rounded-lg px-3 py-2">
                <StatusBadge status={s.status} />
                <span className="text-sm text-slate-300 truncate">{s.display_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">History</p>
          <div className="flex gap-1">
            {[1, 2, 6, 24].map((h) => (
              <button
                key={h}
                onClick={() => setHistoryHours(h)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  historyHours === h
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No data yet — snapshots are collected every 60 s
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={history.map((p) => ({ ...p, time: formatTime(p.timestamp) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94a3b8" }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Line type="monotone" dataKey="cpu_percent" name="CPU" stroke="#6366f1" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="memory_percent" name="RAM" stroke="#10b981" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="disk_percent" name="Disk" stroke="#f59e0b" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top processes */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Top Processes</p>
          <div className="flex gap-1">
            <button
              onClick={() => setSortBy("cpu")}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                sortBy === "cpu" ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
              }`}
            >
              CPU
            </button>
            <button
              onClick={() => setSortBy("memory")}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                sortBy === "memory" ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
              }`}
            >
              RAM
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-3">PID</th>
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">User</th>
                <th className="pb-2 pr-3 text-right">CPU%</th>
                <th className="pb-2 pr-3 text-right">RAM%</th>
                <th className="pb-2 text-right">RSS</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => (
                <tr key={p.pid} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="py-1.5 pr-3 text-slate-500">{p.pid}</td>
                  <td className="py-1.5 pr-3 font-medium text-slate-200 max-w-[120px] truncate">{p.name}</td>
                  <td className="py-1.5 pr-3 text-slate-500 text-xs">{p.username}</td>
                  <td className="py-1.5 pr-3 text-right text-indigo-400">{p.cpu_percent.toFixed(1)}%</td>
                  <td className="py-1.5 pr-3 text-right text-emerald-400">{p.memory_percent.toFixed(1)}%</td>
                  <td className="py-1.5 text-right text-slate-400">{formatBytes(p.memory_bytes)}</td>
                </tr>
              ))}
              {processes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* All disks */}
      {data && data.disk.length > 1 && (
        <div className="card space-y-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">All Disks</h2>
          {data.disk.map((d) => (
            <div key={d.mountpoint} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-24 truncate">{d.mountpoint}</span>
              <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${d.percent}%` }} />
              </div>
              <span className="text-xs text-slate-400 w-10 text-right">{Math.round(d.percent)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
