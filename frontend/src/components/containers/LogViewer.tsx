import { useEffect, useRef, useState } from "react";

interface LogViewerProps {
  lines: string[];
  connected: boolean;
  onClear: () => void;
  onReconnect: () => void;
}

export default function LogViewer({
  lines,
  connected,
  onClear,
  onReconnect,
}: LogViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, autoScroll]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 bg-slate-800 border-b border-slate-700/50 flex-wrap">
        <span
          className={`flex items-center gap-1.5 text-xs font-medium ${
            connected ? "text-emerald-400" : "text-red-400"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"} animate-pulse`}
          />
          {connected ? "Connected" : "Disconnected"}
        </span>

        <span className="text-xs text-slate-500">{lines.length} lines</span>

        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-indigo-500"
          />
          Auto-scroll
        </label>

        {!connected && (
          <button onClick={onReconnect} className="btn-ghost text-xs py-1">
            Reconnect
          </button>
        )}

        <button onClick={onClear} className="btn-ghost text-xs py-1">
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-300 p-3 leading-5 min-h-0">
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
