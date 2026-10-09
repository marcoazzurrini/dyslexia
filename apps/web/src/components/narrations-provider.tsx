import {
  listNarrations,
  removeNarration,
  retryNarration,
  startNarration,
} from "@dyslexia/narrations/client";
import type { Narration } from "@dyslexia/narrations/client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { play, stop, useNowPlaying } from "../lib/now-playing";
import { recordingOf } from "../lib/recording";
import { expireIfUnauthorized } from "../lib/session";
import { usePolling } from "../lib/use-polling";
import { FailedSheet } from "../screens/failed-sheet";
import { NarrationOptionsSheet } from "../screens/narration-options-sheet";
import { NewNarrationSheet } from "../screens/new-narration-sheet";

type Failed = Extract<Narration, { state: "failed" }>;
type Ready = Extract<Narration, { state: "ready" }>;

interface Narrations {
  /** `null` while the first load is in flight. */
  readonly narrations: readonly Narration[] | null;
  readonly loadError?: string;
  /** Why the last deletion failed. */
  readonly deleteError?: string;
  readonly handleReload: () => void;
  readonly handleAdd: () => void;
  readonly handlePlay: (narration: Ready) => void;
  readonly handleOpenFailed: (narration: Failed) => void;
  readonly handleOpenOptions: (narration: Ready) => void;
  readonly handleRemove: (narration: Ready | Failed) => void;
}

const NarrationsContext = createContext<Narrations | null>(null);

/** The narrations every tab shows, and what can be done with them. */
export const useNarrations = () => {
  const narrations = useContext(NarrationsContext);
  if (!narrations) {
    throw new Error("useNarrations needs a NarrationsProvider");
  }
  return narrations;
};

/**
 * Loads the library, keeps it fresh while narrations are being made, and
 * holds the sheets for adding, retrying, and deleting. Every tab shares it,
 * so switching tabs never loads the library again.
 */
export const NarrationsProvider = ({ children }: { children: ReactNode }) => {
  const [narrations, setNarrations] = useState<readonly Narration[] | null>(
    null
  );
  const [loadError, setLoadError] = useState("");
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState<Failed | null>(null);
  const [options, setOptions] = useState<Ready | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const { recording } = useNowPlaying();
  const [busy, setBusy] = useState<"add" | "retry" | "remove" | null>(null);
  const [actionError, setActionError] = useState("");

  const reload = usePolling(listNarrations, {
    enabled: busy === null,
    keepPolling: (list) => list.some((item) => item.state === "making"),
    onData: (list) => {
      setNarrations(list);
      setLoadError("");
    },
    onError: (error) => {
      if (!expireIfUnauthorized(error)) {
        setLoadError(error.message);
      }
    },
  });

  /** Runs an action, then closes its sheet and shows the new library. */
  const act = useCallback(
    async (kind: "add" | "retry", action: () => Promise<void>) => {
      setBusy(kind);
      setActionError("");
      try {
        await action();
        setAdding(false);
        setFailed(null);
        reload();
      } catch (error) {
        const failure =
          error instanceof Error ? error : new Error("The request failed.");
        if (!expireIfUnauthorized(failure)) {
          setActionError(failure.message);
        }
      }
      setBusy(null);
    },
    [reload]
  );

  /** Removes a narration at once, and brings it back if the server refuses. */
  const remove = useCallback(
    async (narration: Ready | Failed) => {
      setOptions(null);
      setFailed(null);
      setDeleteError("");
      setNarrations(
        (list) => list?.filter((item) => item.id !== narration.id) ?? null
      );
      if (recording?.id === narration.id) {
        stop();
      }
      // Polling pauses meanwhile, so a list read before the deletion cannot
      // bring the narration back; it resumes with a fresh read.
      setBusy("remove");
      try {
        await removeNarration(narration.id);
      } catch (error) {
        const failure =
          error instanceof Error ? error : new Error("The request failed.");
        if (!expireIfUnauthorized(failure)) {
          setDeleteError(failure.message);
        }
      }
      setBusy(null);
    },
    [recording]
  );

  const value = useMemo<Narrations>(
    () => ({
      deleteError: deleteError || undefined,
      handleAdd: () => {
        setActionError("");
        setAdding(true);
      },
      handleOpenFailed: (narration) => {
        setActionError("");
        setFailed(narration);
      },
      handleOpenOptions: setOptions,
      handlePlay: (narration) => play(recordingOf(narration)),
      handleReload: () => {
        setLoadError("");
        reload();
      },
      handleRemove: (narration) => {
        void remove(narration);
      },
      loadError: loadError || undefined,
      narrations,
    }),
    [deleteError, loadError, narrations, reload, remove]
  );

  return (
    <NarrationsContext value={value}>
      {children}
      <NewNarrationSheet
        open={adding}
        onClose={() => setAdding(false)}
        busy={busy === "add"}
        error={(adding && actionError) || undefined}
        onSubmit={(url) => {
          void act("add", async () => {
            await startNarration(url);
          });
        }}
      />
      <FailedSheet
        narration={failed}
        onClose={() => setFailed(null)}
        busy={busy === "retry" || busy === "remove" ? busy : null}
        error={(failed && actionError) || undefined}
        onRetry={() => {
          if (failed) {
            void act("retry", async () => {
              await retryNarration(failed.id);
            });
          }
        }}
        onRemove={() => {
          if (failed) {
            void remove(failed);
          }
        }}
      />
      <NarrationOptionsSheet
        narration={options}
        onClose={() => setOptions(null)}
        onDelete={() => {
          if (options) {
            void remove(options);
          }
        }}
      />
    </NarrationsContext>
  );
};
