import { useCallback, useEffect, useRef, useState } from "react";
import { getMetrics } from "../api/system";
import type { SystemMetrics } from "../types/system";

export function useMetrics(intervalMs = 5000) {
  const [data, setData] = useState<SystemMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const metrics = await getMetrics();
      setData(metrics);
      setError(null);
    } catch {
      setError("Failed to fetch metrics");
    }
  }, []);

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(fetch, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch, intervalMs]);

  return { data, error };
}
