import { useCallback, useEffect, useRef, useState } from "react";

const MAX_LINES = 5000;

export function useContainerLogs(containerId: string) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    const url = `${protocol}://${host}/api/v1/docker/logs/${containerId}?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      setLines((prev) => {
        const next = [...prev, e.data as string];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    };
  }, [containerId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const clear = useCallback(() => setLines([]), []);

  return { lines, connected, clear, reconnect: connect };
}
