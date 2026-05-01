import { createContext, useCallback, useContext, useState } from "react";
import { runCleanup, scanDisk } from "../api/cleanup";
import type { CleanupActionResult, CleanupScanResult } from "../types/cleanup";

interface CleanupCtx {
  scanning: boolean;
  running: boolean;
  scan: CleanupScanResult | null;
  selected: Set<string>;
  results: CleanupActionResult[] | null;
  error: string | null;
  doScan: () => Promise<void>;
  doClean: () => Promise<void>;
  toggle: (key: string) => void;
  selectAll: (keys: string[]) => void;
  clearAll: () => void;
  clearResults: () => void;
}

const Ctx = createContext<CleanupCtx | null>(null);

export function CleanupProvider({ children }: { children: React.ReactNode }) {
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [scan, setScan] = useState<CleanupScanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<CleanupActionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doScan = useCallback(async () => {
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
  }, []);

  const doClean = useCallback(async () => {
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
  }, [selected]);

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback((keys: string[]) => setSelected(new Set(keys)), []);
  const clearAll = useCallback(() => setSelected(new Set()), []);
  const clearResults = useCallback(() => { setResults(null); setError(null); }, []);

  return (
    <Ctx.Provider value={{
      scanning, running, scan, selected, results, error,
      doScan, doClean, toggle, selectAll, clearAll, clearResults,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCleanup() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCleanup must be used within CleanupProvider");
  return ctx;
}
