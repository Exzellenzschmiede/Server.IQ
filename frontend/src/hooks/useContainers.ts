import { useCallback, useEffect, useRef, useState } from "react";
import { getContainers } from "../api/docker";
import type { ContainersResponse } from "../types/docker";

export function useContainers(intervalMs = 10000) {
  const [data, setData] = useState<ContainersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await getContainers();
      setData(result);
      setError(null);
    } catch {
      setError("Failed to fetch containers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(fetch, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch, intervalMs]);

  return { data, error, loading, refresh: fetch };
}
