import {
  listNarrations,
  removeNarration,
  retryNarration,
  startNarration,
} from "@dyslexia/narrations/client";
import type { Narration } from "@dyslexia/narrations/client";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { play } from "../lib/now-playing";
import { recordingOf } from "../lib/recording";
import { expireIfUnauthorized, signOut } from "../lib/session";
import { usePolling } from "../lib/use-polling";
import { usePlayerInset } from "../player/inset";
import { AccountSheet } from "../screens/account-sheet";
import { FailedSheet } from "../screens/failed-sheet";
import { LibraryScreen } from "../screens/library-screen";
import { NewNarrationSheet } from "../screens/new-narration-sheet";

type Failed = Extract<Narration, { state: "failed" }>;

const Library = () => {
  const [narrations, setNarrations] = useState<readonly Narration[] | null>(
    null
  );
  const [loadError, setLoadError] = useState("");
  const [sheet, setSheet] = useState<"add" | "account" | null>(null);
  const [failed, setFailed] = useState<Failed | null>(null);
  const [busy, setBusy] = useState<
    "add" | "retry" | "remove" | "account" | null
  >(null);
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
  const act = async (
    kind: "add" | "retry" | "remove",
    action: () => Promise<void>
  ) => {
    setBusy(kind);
    setActionError("");
    try {
      await action();
      setSheet(null);
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
  };

  const leave = async () => {
    setBusy("account");
    try {
      await signOut();
    } catch {
      // Still signed in; the account sheet stays open to try again.
      setBusy(null);
    }
  };

  return (
    <>
      <LibraryScreen
        narrations={narrations}
        error={loadError || undefined}
        bottomInset={usePlayerInset()}
        onReload={() => {
          setLoadError("");
          reload();
        }}
        onAdd={() => {
          setActionError("");
          setSheet("add");
        }}
        onAccount={() => setSheet("account")}
        onPlay={(narration) => play(recordingOf(narration))}
        onOpenFailed={(narration) => {
          setActionError("");
          setFailed(narration);
        }}
      />
      <NewNarrationSheet
        open={sheet === "add"}
        onClose={() => setSheet(null)}
        busy={busy === "add"}
        error={(sheet === "add" && actionError) || undefined}
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
            void act("remove", () => removeNarration(failed.id));
          }
        }}
      />
      <AccountSheet
        open={sheet === "account"}
        onClose={() => setSheet(null)}
        busy={busy === "account"}
        onSignOut={() => {
          void leave();
        }}
      />
    </>
  );
};

export const Route = createFileRoute("/")({ component: Library });
