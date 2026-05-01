import { useState } from "react";
import { dnsLookup, pingHost, portCheck } from "../api/network";
import type { DnsResponse, PingResponse, PortCheckResponse } from "../api/network";

const DNS_TYPES = ["A", "AAAA", "MX", "TXT", "CNAME", "NS", "PTR", "SOA"];

type Tab = "ping" | "dns" | "port";

function ResultBox({ ok, content }: { ok: boolean; content: string }) {
  return (
    <pre className={`mt-3 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap break-all border ${
      ok
        ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-300"
        : "bg-red-950/30 border-red-500/20 text-red-400"
    }`}>
      {content}
    </pre>
  );
}

export default function NetworkPage() {
  const [tab, setTab] = useState<Tab>("ping");

  // Ping
  const [pingHost_, setPingHost] = useState("");
  const [pingCount, setPingCount] = useState(4);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<PingResponse | null>(null);

  // DNS
  const [dnsHost, setDnsHost] = useState("");
  const [dnsType, setDnsType] = useState("A");
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsResult, setDnsResult] = useState<DnsResponse | null>(null);

  // Port
  const [portHost, setPortHost] = useState("");
  const [portNum, setPortNum] = useState<number | "">("");
  const [portLoading, setPortLoading] = useState(false);
  const [portResult, setPortResult] = useState<PortCheckResponse | null>(null);

  const [error, setError] = useState<string | null>(null);

  function getError(e: unknown): string {
    return (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Request failed";
  }

  async function handlePing(e: React.FormEvent) {
    e.preventDefault();
    if (!pingHost_.trim()) return;
    setPingLoading(true);
    setPingResult(null);
    setError(null);
    try {
      setPingResult(await pingHost(pingHost_.trim(), pingCount));
    } catch (err) {
      setError(getError(err));
    } finally {
      setPingLoading(false);
    }
  }

  async function handleDns(e: React.FormEvent) {
    e.preventDefault();
    if (!dnsHost.trim()) return;
    setDnsLoading(true);
    setDnsResult(null);
    setError(null);
    try {
      setDnsResult(await dnsLookup(dnsHost.trim(), dnsType));
    } catch (err) {
      setError(getError(err));
    } finally {
      setDnsLoading(false);
    }
  }

  async function handlePort(e: React.FormEvent) {
    e.preventDefault();
    if (!portHost.trim() || !portNum) return;
    setPortLoading(true);
    setPortResult(null);
    setError(null);
    try {
      setPortResult(await portCheck(portHost.trim(), Number(portNum)));
    } catch (err) {
      setError(getError(err));
    } finally {
      setPortLoading(false);
    }
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "ping",  label: "Ping",       icon: "📡" },
    { key: "dns",   label: "DNS Lookup", icon: "🔍" },
    { key: "port",  label: "Port Check", icon: "🔌" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">Network Diagnostics</h1>
      <p className="text-sm text-slate-400">Run network checks directly from the server.</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setError(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === key
                ? "bg-slate-700 text-slate-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="card bg-red-600/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {/* Ping */}
      {tab === "ping" && (
        <div className="card space-y-3">
          <form onSubmit={handlePing} className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-xs text-slate-400">Hostname / IP</label>
              <input
                value={pingHost_}
                onChange={(e) => setPingHost(e.target.value)}
                placeholder="8.8.8.8 or example.com"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1 w-20">
              <label className="text-xs text-slate-400">Count</label>
              <input
                type="number"
                value={pingCount}
                onChange={(e) => setPingCount(Number(e.target.value))}
                min={1}
                max={10}
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button type="submit" disabled={pingLoading || !pingHost_.trim()} className="btn-primary py-1.5 px-4">
              {pingLoading ? "Pinging…" : "Ping"}
            </button>
          </form>
          {pingResult && (
            <>
              {pingResult.avg_ms !== null && pingResult.ok && (
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-400 font-semibold">✓ Reachable</span>
                  <span className="text-slate-400">avg RTT: <span className="text-slate-200 font-mono">{pingResult.avg_ms} ms</span></span>
                </div>
              )}
              <ResultBox ok={pingResult.ok} content={pingResult.output} />
            </>
          )}
        </div>
      )}

      {/* DNS */}
      {tab === "dns" && (
        <div className="card space-y-3">
          <form onSubmit={handleDns} className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-xs text-slate-400">Hostname / IP</label>
              <input
                value={dnsHost}
                onChange={(e) => setDnsHost(e.target.value)}
                placeholder="example.com"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="text-xs text-slate-400">Record type</label>
              <select
                value={dnsType}
                onChange={(e) => setDnsType(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {DNS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button type="submit" disabled={dnsLoading || !dnsHost.trim()} className="btn-primary py-1.5 px-4">
              {dnsLoading ? "Looking up…" : "Lookup"}
            </button>
          </form>
          {dnsResult && <ResultBox ok={dnsResult.ok} content={dnsResult.output} />}
        </div>
      )}

      {/* Port check */}
      {tab === "port" && (
        <div className="card space-y-3">
          <form onSubmit={handlePort} className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-xs text-slate-400">Hostname / IP</label>
              <input
                value={portHost}
                onChange={(e) => setPortHost(e.target.value)}
                placeholder="example.com or 10.0.0.1"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <label className="text-xs text-slate-400">Port</label>
              <input
                type="number"
                value={portNum}
                onChange={(e) => setPortNum(e.target.value ? Number(e.target.value) : "")}
                min={1}
                max={65535}
                placeholder="443"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button type="submit" disabled={portLoading || !portHost.trim() || !portNum} className="btn-primary py-1.5 px-4">
              {portLoading ? "Checking…" : "Check"}
            </button>
          </form>
          {portResult && (
            <>
              <div className={`flex items-center gap-2 text-sm font-semibold ${portResult.open ? "text-emerald-400" : "text-red-400"}`}>
                {portResult.open ? "✓ Port is open" : "✗ Port is closed / filtered"}
              </div>
              <ResultBox ok={portResult.open} content={portResult.output} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
