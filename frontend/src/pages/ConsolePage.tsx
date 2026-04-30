import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";

export default function ConsolePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#0f172a",
        foreground: "#e2e8f0",
        cursor: "#818cf8",
        cursorAccent: "#0f172a",
        selectionBackground: "#6366f133",
        black: "#1e293b",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#fbbf24",
        blue: "#818cf8",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e2e8f0",
        brightBlack: "#475569",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde68a",
        brightBlue: "#a5b4fc",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#f8fafc",
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    const token = localStorage.getItem("access_token");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/api/v1/console/ws?token=${token}`);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
    };

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        terminal.write(new Uint8Array(e.data));
      } else {
        terminal.write(e.data as string);
      }
    };

    ws.onclose = () => {
      terminal.writeln("\r\n\x1b[33mVerbindung getrennt.\x1b[0m");
    };

    ws.onerror = () => {
      terminal.writeln("\r\n\x1b[31mVerbindungsfehler.\x1b[0m");
    };

    // Keyboard input → PTY (as binary to avoid confusion with JSON resize messages)
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });

    // Terminal resize → server resize event
    terminal.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    const onResize = () => fitAddon.fit();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ws.close();
      terminal.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col h-full p-4 gap-3" style={{ height: "calc(100vh - 56px)" }}>
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Konsole</h1>
        <p className="text-xs text-slate-500">SSH-Verbindung zum VPS-Host · Benutzer: {" "}
          <span className="font-mono text-slate-400">{location.hostname}</span>
        </p>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 rounded-lg overflow-hidden border border-slate-700/50 bg-slate-950 p-2"
      />
    </div>
  );
}
