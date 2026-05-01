import { useEffect, useRef, useState } from "react";

const MAX_LINES = 2000;

export default function AppLogsPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/api/v1/logs/stream?token=${token}&lines=300`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onmessage = (e: MessageEvent) => {
      setLines((prev) => {
        const next = [...prev, String(e.data)];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, autoScroll]);

  const filterLower = filter.toLowerCase();
  const visibleLines = filter
    ? lines.filter((l) => l.toLowerCase().includes(filterLower))
    : lines;

  return (
    <div className="p-4 md:p-6 flex flex-col h-[calc(100vh-5rem)] md:h-screen">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Application Logs</h1>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${connected ? "text-emerald-400" : "text-red-400"}`}>
            {connected ? "● Live" : "○ Disconnected"}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded accent-indigo-500"
            />
            Auto-scroll
          </label>
          <button
            onClick={() => setLines([])}
            className="btn-ghost text-xs py-1 px-2"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter lines…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500 text-slate-200 placeholder-slate-600"
        />
        {filter && (
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {visibleLines.length} / {lines.length}
          </span>
        )}
        {filter && (
          <button
            onClick={() => setFilter("")}
            className="text-xs text-slate-500 hover:text-slate-300 px-1"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 bg-slate-950 rounded-lg font-mono text-xs overflow-auto p-3 min-h-0 border border-slate-700/50">
        {visibleLines.length === 0 ? (
          <p className="text-slate-600">
            {lines.length === 0
              ? connected ? "Waiting for logs…" : "Connecting…"
              : "No lines match filter"}
          </p>
        ) : (
          visibleLines.map((line, i) => (
            <div
              key={i}
              className={`leading-5 whitespace-pre-wrap break-all ${
                line.includes("ERROR") || line.includes("error")
                  ? "text-red-400"
                  : line.includes("WARN") || line.includes("warning")
                  ? "text-yellow-400"
                  : "text-slate-300"
              }`}
            >
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
