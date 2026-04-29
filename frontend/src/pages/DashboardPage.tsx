import { useEffect, useState } from "react";
import { getSystemInfo } from "../api/system";
import GaugeChart from "../components/ui/GaugeChart";
import MetricCard from "../components/ui/MetricCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useMetrics } from "../hooks/useMetrics";
import type { SystemInfo } from "../types/system";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DashboardPage() {
  const { data, error } = useMetrics(5000);
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    getSystemInfo().then(setInfo).catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="p-6 text-red-400">
        Failed to load metrics. Is the backend running?
      </div>
    );
  }

  const primaryDisk = data?.disk[0];
  const primaryNet = data?.network[0];

  return (
    <div className="p-4 md:p-6 space-y-6">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GaugeChart value={data?.cpu.percent ?? 0} label="CPU" />
        <GaugeChart value={data?.memory.percent ?? 0} label="RAM" />
        <GaugeChart value={primaryDisk?.percent ?? 0} label="Disk" />
        <GaugeChart
          value={
            primaryNet
              ? Math.min(
                  ((primaryNet.bytes_recv_per_sec + primaryNet.bytes_sent_per_sec) / (1024 * 1024)) *
                    10,
                  100
                )
              : 0
          }
          label="Network"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            value={`↓ ${formatBytes(primaryNet.bytes_recv_per_sec)}/s`}
            sub={`↑ ${formatBytes(primaryNet.bytes_sent_per_sec)}/s`}
            icon="🌐"
            color="rose"
          />
        )}
      </div>

      {data && data.disk.length > 1 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">All Disks</h2>
          {data.disk.map((d) => (
            <div key={d.mountpoint} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-24 truncate">{d.mountpoint}</span>
              <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full"
                  style={{ width: `${d.percent}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 w-10 text-right">{Math.round(d.percent)}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <StatusBadge status="active" />
        <span>System online</span>
      </div>
    </div>
  );
}
