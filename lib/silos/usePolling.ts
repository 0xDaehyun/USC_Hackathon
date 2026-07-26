"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Poll an async loader on an interval (the demo uses 10-15s polling instead
 * of WebSockets — simpler and safer to run live on stage).
 *
 * Pass a stable loader (module-level function or useCallback) — the interval
 * restarts when the loader identity changes.
 */
export function usePolling<T>(
  loader: () => Promise<T>,
  intervalMs: number,
): { data: T | null; error: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    loader()
      .then((result) => {
        setData(result);
        setError(false);
      })
      .catch(() => setError(true));
  }, [loader]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
