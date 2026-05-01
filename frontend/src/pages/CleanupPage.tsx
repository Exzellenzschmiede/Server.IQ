import { useState } from "react";
import { runCleanup, scanDisk } from "../api/cleanup";
import type { CleanableItem, CleanupActionResult, CleanupScanResult } from "../types/cleanup";

function fmt(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + " GB";
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

function ItemRow({
  item,
  checked,
  onToggle,
}: {
  item: CleanableItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={`flex items-start gap-3 py-3 px-1 cursor-pointer ${!item.available ? "opacity-40" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={!item.available}
        className="mt-0.5 accent-indigo-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-200">{item.label}</span>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {item.size_bytes > 0 ? fmt(item.size_bytes) : "—"}
            {item.count > 0 ? ` · ${item.count} item${item.count !== 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
      </div>
    </label>
  );
}

function ResultRow({ r }: { r: CleanupActionResult }) {
  return (
    <div className={`flex items-start gap-2 text-xs ${r.ok ? "text-emerald-400" : "text-red-400"}`}>
      <span>{r.ok ? "✓" : "✗"}</span>
      <div>
        <span className="font-medium">{r.key}</span>
        {r.freed_bytes > 0 && <span className="text-slate-500 ml-2">freed {fmt(r.freed_bytes)}</span>}
        <p className="text-slate-500 mt-0.5">{r.message}</p>
      </div>
    </div>
  );
}

export default function CleanupPage() {
  const [scan, setScan] = useState<CleanupScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CleanupActionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doScan() {
    setScanning(true);
    setError(null);
    setResults(null);
    try {
      const res = await scanDisk();
      setScan(res);
      setSelected(new Set(res.items.filter((i) => i.available && i.size_bytes > 0).map((i) => i.key)));
    } catch {
      setError("Scan failed. Make sure you have admin access.");
    } finally {
      setScanning(false);
    }
  }

  async function doClean() {
    if (selected.size === 0) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runCleanup(Array.from(selected));
      setResults(res.results);
      setScan(null);
      setSelected(new Set());
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ? `Cleanup failed: ${detail}` : "Cleanup failed.");
    } finally {
      setRunning(false);
    }
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const totalSelected = scan?.items
    .filter((i) => selected.has(i.key))
    .reduce((s, i) => s + i.size_bytes, 0) ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Disk Cleanup</h1>
        <button
          onClick={doScan}
          disabled={scanning || running}
          className="btn-ghost"
        >
          {scanning ? "Scanning…" : scan ? "Re-scan" : "Scan"}
        </button>
      </div>

      {error && (
        <div className="card text-sm text-red-400 border border-red-500/30 bg-red-600/10">{error}</div>
      )}

      {!scan && !scanning && (
        <div className="card py-12 text-center space-y-3">
          <p className="text-slate-400 text-sm">Scan your system to identify reclaimable disk space.</p>
          <button onClick={doScan} className="btn-primary">
            Start Scan
          </button>
        </div>
      )}

      {scanning && (
        <div className="card py-12 text-center text-slate-500 text-sm">Scanning…</div>
      )}

      {scan && !scanning && (
        <>
          <div className="card divide-y divide-slate-700/50">
            <div className="pb-3 px-1 flex items-center justify-between">
              <span className="text-sm text-slate-400">
                Total reclaimable:{" "}
                <span className="font-semibold text-slate-200">{fmt(scan.total_bytes)}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set(scan.items.filter((i) => i.available).map((i) => i.key)))}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
            </div>
            {scan.items.map((item) => (
              <ItemRow
                key={item.key}
                item={item}
                checked={selected.has(item.key)}
                onToggle={() => toggle(item.key)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-400">
              {selected.size} categor{selected.size !== 1 ? "ies" : "y"} selected
              {totalSelected > 0 && (
                <span className="text-slate-500 ml-1">({fmt(totalSelected)} estimated)</span>
              )}
            </span>
            <button
              onClick={doClean}
              disabled={selected.size === 0 || running}
              className="btn-primary"
            >
              {running ? "Cleaning…" : "Clean selected"}
            </button>
          </div>
        </>
      )}

      {results && results.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Results</h2>
            <button onClick={doScan} disabled={scanning} className="btn-ghost text-xs">
              {scanning ? "Scanning…" : "Re-scan"}
            </button>
          </div>
          <div className="space-y-2">
            {results.map((r) => (
              <ResultRow key={r.key} r={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
