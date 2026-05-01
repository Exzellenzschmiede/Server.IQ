import { useEffect, useState } from "react";
import { getOpenPorts } from "../api/system";
import type { PortInfo } from "../types/system";

export default function PortsPage() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("LISTEN");

  async function load() {
    setLoading(true);
    try {
      setPorts(await getOpenPorts());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const states = [...new Set(ports.map((p) => p.state).filter(Boolean))].sort();

  const filtered = ports.filter((p) => {
    const matchState = stateFilter === "ALL" || p.state === stateFilter;
    const q = filter.toLowerCase();
    const matchSearch = !q || [
      String(p.local_port),
      p.local_address,
      p.process_name ?? "",
      String(p.pid ?? ""),
    ].some((v) => v.toLowerCase().includes(q));
    return matchState && matchSearch;
  });

  function stateColor(state: string) {
    if (state === "LISTEN") return "text-emerald-400";
    if (state === "ESTABLISHED") return "text-sky-400";
    if (state === "CLOSE_WAIT") return "text-yellow-400";
    return "text-slate-400";
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Open Ports</h1>
        <div className="flex gap-2 flex-wrap">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="ALL">All states</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter port, process…"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 w-44"
          />
          <button onClick={load} className="btn-secondary py-1.5 px-3 text-sm">Refresh</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500 py-4">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-4 font-medium">Port</th>
                <th className="pb-2 pr-4 font-medium">Protocol</th>
                <th className="pb-2 pr-4 font-medium">Address</th>
                <th className="pb-2 pr-4 font-medium">State</th>
                <th className="pb-2 pr-4 font-medium">PID</th>
                <th className="pb-2 font-medium">Process</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-slate-500">No ports match the filter</td></tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={i} className="text-slate-300 hover:bg-slate-800/40">
                    <td className="py-1.5 pr-4 font-bold font-mono text-indigo-300">{p.local_port}</td>
                    <td className="py-1.5 pr-4 text-xs text-slate-400 uppercase">{p.protocol}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs text-slate-400">{p.local_address}</td>
                    <td className={`py-1.5 pr-4 text-xs font-medium ${stateColor(p.state)}`}>{p.state}</td>
                    <td className="py-1.5 pr-4 text-xs text-slate-500">{p.pid ?? "—"}</td>
                    <td className="py-1.5 text-xs">{p.process_name ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-600">{filtered.length} of {ports.length} connections shown</p>
    </div>
  );
}
