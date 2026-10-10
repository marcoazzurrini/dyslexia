import type { Narration } from "./narration.ts";
import {
  listNarrations,
  NarrationsError,
  removeNarration,
  retryNarration,
  startNarration,
} from "./requests.ts";

/** The library as the app shows it. */
export interface LibraryState {
  /** Newest first; `null` until the first load. */
  readonly narrations: readonly Narration[] | null;
  /** Why the last load failed, until one succeeds. */
  readonly error: NarrationsError | null;
}

/**
 * The listener's narrations, kept fresh. Changes show at once, and a list
 * read before a change can never undo it.
 */
export interface LiveLibrary {
  /** Calls `listener` whenever the state changes, until unsubscribed. */
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => LibraryState;
  /**
   * Keeps the library fresh until the returned function stops it: loads
   * now and whenever the page shows again, and every few seconds while a
   * narration is being made. A hidden page loads nothing.
   */
  readonly connect: () => () => void;
  /** Loads again now, as when the listener retries. */
  readonly reload: () => void;
  /** Starts making a narration of the article at `url`. */
  readonly add: (url: string) => Promise<void>;
  /** Makes a failed narration again. */
  readonly retry: (id: string) => Promise<void>;
  /** Removes a narration at once; it comes back if the server refuses. */
  readonly remove: (id: string) => Promise<void>;
}

const INTERVAL_MS = 3000;

export const createLibrary = (): LiveLibrary => {
  let state: LibraryState = { error: null, narrations: null };
  const listeners = new Set<() => void>();
  const set = (next: Partial<LibraryState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) {
      listener();
    }
  };

  let connected = false;
  /** The load in flight, if any. */
  let loading: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Changes in flight. Loads wait for them, then load again. */
  let changing = 0;

  const stopLoading = () => {
    clearTimeout(timer);
    loading?.abort();
    loading = null;
  };

  const load = async () => {
    clearTimeout(timer);
    if (
      !connected ||
      changing > 0 ||
      loading ||
      document.visibilityState !== "visible"
    ) {
      return;
    }
    const current = new AbortController();
    loading = current;
    try {
      const narrations = await listNarrations(current.signal);
      if (!current.signal.aborted) {
        set({ error: null, narrations });
        if (narrations.some((narration) => narration.state === "making")) {
          timer = setTimeout(() => {
            void load();
          }, INTERVAL_MS);
        }
      }
    } catch (error) {
      if (!current.signal.aborted) {
        set({
          error:
            error instanceof NarrationsError
              ? error
              : new NarrationsError("unavailable"),
        });
      }
    }
    if (loading === current) {
      loading = null;
    }
  };

  /** Runs a change, so no list read before it finishes can undo it. */
  const change = async (request: () => Promise<void>) => {
    changing += 1;
    stopLoading();
    try {
      await request();
    } catch (error) {
      throw error instanceof NarrationsError
        ? error
        : new NarrationsError("unavailable");
    } finally {
      changing -= 1;
      void load();
    }
  };

  return {
    add: (url) =>
      change(async () => {
        await startNarration(url);
      }),
    connect: () => {
      connected = true;
      const visibility = () => {
        if (document.visibilityState === "visible") {
          void load();
        } else {
          stopLoading();
        }
      };
      document.addEventListener("visibilitychange", visibility);
      void load();
      return () => {
        connected = false;
        stopLoading();
        document.removeEventListener("visibilitychange", visibility);
      };
    },
    getSnapshot: () => state,
    reload: () => {
      if (state.error) {
        set({ error: null });
      }
      void load();
    },
    remove: (id) => {
      set({
        narrations:
          state.narrations?.filter((narration) => narration.id !== id) ?? null,
      });
      return change(() => removeNarration(id));
    },
    retry: (id) =>
      change(async () => {
        await retryNarration(id);
      }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
