import { useCallback, useEffect, useRef } from "react";

const INTERVAL_MS = 3000;

/**
 * Loads data now and again whenever the page becomes visible. While
 * `keepPolling` returns true for the latest result, it reloads every three
 * seconds after the previous load finishes, so slow requests never overlap.
 * Hidden pages stop polling and abort any load in flight.
 */
export const usePolling = <A>(
  load: (signal: AbortSignal) => Promise<A>,
  {
    enabled,
    keepPolling,
    onData,
    onError,
  }: {
    enabled: boolean;
    keepPolling: (data: A) => boolean;
    onData: (data: A) => void;
    onError: (error: Error) => void;
  }
) => {
  // Callers pass fresh closures each render; the loop reads the latest ones.
  const latest = useRef({ keepPolling, load, onData, onError });
  const reload = useRef<(() => void) | null>(null);
  useEffect(() => {
    latest.current = { keepPolling, load, onData, onError };
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      if (stopped || document.visibilityState !== "visible" || controller) {
        return;
      }
      const current = new AbortController();
      controller = current;
      try {
        const data = await latest.current.load(current.signal);
        if (!stopped && !current.signal.aborted) {
          latest.current.onData(data);
          if (latest.current.keepPolling(data)) {
            timer = setTimeout(refresh, INTERVAL_MS);
          }
        }
      } catch (error) {
        if (!stopped && !current.signal.aborted) {
          latest.current.onError(
            error instanceof Error ? error : new Error("The request failed.")
          );
        }
      }
      controller = null;
      // The page may become visible again before an aborted load settles.
      if (
        !stopped &&
        current.signal.aborted &&
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        void refresh();
      } else {
        controller?.abort();
      }
    };

    reload.current = () => {
      clearTimeout(timer);
      void refresh();
    };
    void refresh();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled]);

  /** Loads again now, as after the person retries. */
  return useCallback(() => reload.current?.(), []);
};
