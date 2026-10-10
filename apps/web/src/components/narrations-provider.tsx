import { createLibrary } from "@dyslexia/narrations/client";
import type { Narration } from "@dyslexia/narrations/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import { markFinished, useListening } from "../lib/listening";
import { open, playback, stop, useNowPlaying } from "../lib/now-playing";
import { recordingOf } from "../lib/recording";
import { expireIfUnauthorized } from "../lib/session";
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
  /** Opens the full player with a narration, without playing it. */
  readonly handleOpen: (narration: Ready) => void;
  /** Plays a narration at once, leaving the player closed. */
  readonly handleListen: (narration: Ready) => void;
  readonly handlePause: () => void;
  /** The narration playing now, if any. */
  readonly playingId?: string;
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
 * Shows the live library, and holds the sheets for adding, retrying, and
 * deleting. Every tab shares it, so switching tabs never loads the library
 * again.
 */
export const NarrationsProvider = ({ children }: { children: ReactNode }) => {
  // One per sign-in, so a new account never sees the last one's library.
  // eslint-disable-next-line react/hook-use-state -- Created once, never replaced.
  const [library] = useState(createLibrary);
  const { error: loadError, narrations } = useSyncExternalStore(
    library.subscribe,
    library.getSnapshot
  );
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState<Failed | null>(null);
  const [options, setOptions] = useState<Ready | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const { paused, recording } = useNowPlaying();
  const listeningOf = useListening();
  const [busy, setBusy] = useState<"add" | "retry" | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => library.connect(), [library]);
  useEffect(() => {
    if (loadError) {
      expireIfUnauthorized(loadError);
    }
  }, [loadError]);

  /** Runs a change, then closes its sheet. */
  const act = useCallback(
    async (kind: "add" | "retry", change: () => Promise<void>) => {
      setBusy(kind);
      setActionError("");
      try {
        await change();
        setAdding(false);
        setFailed(null);
      } catch (error) {
        if (error instanceof Error && !expireIfUnauthorized(error)) {
          setActionError(error.message);
        }
      }
      setBusy(null);
    },
    []
  );

  /** Removes a narration at once; it comes back if the server refuses. */
  const remove = useCallback(
    async (narration: Ready | Failed) => {
      setOptions(null);
      setFailed(null);
      setDeleteError("");
      if (recording?.id === narration.id) {
        stop();
      }
      try {
        await library.remove(narration.id);
      } catch (error) {
        if (error instanceof Error && !expireIfUnauthorized(error)) {
          setDeleteError(error.message);
        }
      }
    },
    [library, recording]
  );

  const value = useMemo<Narrations>(
    () => ({
      deleteError: deleteError || undefined,
      handleAdd: () => {
        setActionError("");
        setAdding(true);
      },
      handleListen: (narration) => playback.play(recordingOf(narration)),
      handleOpen: (narration) => open(recordingOf(narration)),
      handleOpenFailed: (narration) => {
        setActionError("");
        setFailed(narration);
      },
      handleOpenOptions: setOptions,
      handlePause: playback.pause,
      handleReload: library.reload,
      handleRemove: (narration) => {
        void remove(narration);
      },
      loadError:
        loadError && loadError.kind !== "signed-out"
          ? loadError.message
          : undefined,
      narrations,
      playingId: paused ? undefined : recording?.id,
    }),
    [deleteError, library, loadError, narrations, paused, recording, remove]
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
          void act("add", () => library.add(url));
        }}
      />
      <FailedSheet
        narration={failed}
        onClose={() => setFailed(null)}
        busy={busy === "retry" ? busy : null}
        error={(failed && actionError) || undefined}
        onRetry={() => {
          if (failed) {
            void act("retry", () => library.retry(failed.id));
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
        finished={options ? listeningOf(options).status === "finished" : false}
        onClose={() => setOptions(null)}
        onMarkFinished={(finished) => {
          if (options) {
            markFinished(options, finished);
            setOptions(null);
          }
        }}
        onDelete={() => {
          if (options) {
            void remove(options);
          }
        }}
      />
    </NarrationsContext>
  );
};
