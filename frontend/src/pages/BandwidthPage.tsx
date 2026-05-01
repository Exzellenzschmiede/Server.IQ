import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getBandwidth } from "../api/bandwidth";
import type { BandwidthDay } from "../types/bandwidth";

function fmtBytes(b: number): string {
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(2) + " GB";
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(1) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(0) + " KB";
  return b + " B";
}

function shortDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

export default function BandwidthPage() {
  const [days, setDays] = useState<BandwidthDay[]>([]);
  const [totalRecv, setTotalRecv] = useState(0);
  const [totalSent, setTotalSent] = useState(0);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await getBandwidth(period);
      setDays(data.days);
      setTotalRecv(data.total_recv_bytes);
      setTotalSent(data.total_sent_bytes);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [period]);

  const chartData = days.map((d) => ({
    date: shortDate(d.date),
    Received: +(d.recv_bytes / 1024 / 1024).toFixed(1),
    Sent: +(d.sent_bytes / 1024 / 1024).toFixed(1),
  }));

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Bandwidth</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-xl font-bold text-sky-400">{fmtBytes(totalRecv)}</p>
          <p className="text-xs text-slate-500 mt-1">Total received</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-indigo-400">{fmtBytes(totalSent)}</p>
          <p className="text-xs text-slate-500 mt-1">Total sent</p>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No bandwidth data yet — data is collected from metric snapshots (1 point per minute).
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit=" MB" width={60} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v: number) => [`${v} MB`]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Bar dataKey="Received" fill="#38bdf8" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Sent" fill="#818cf8" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {days.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-6 font-medium">Date</th>
                <th className="pb-2 pr-6 font-medium">Received</th>
                <th className="pb-2 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {[...days].reverse().map((d) => (
                <tr key={d.date} className="text-slate-300">
                  <td className="py-1.5 pr-6 text-slate-400">{d.date}</td>
                  <td className="py-1.5 pr-6 text-sky-400">{fmtBytes(d.recv_bytes)}</td>
                  <td className="py-1.5 text-indigo-400">{fmtBytes(d.sent_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
