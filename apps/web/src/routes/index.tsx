import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { play } from "../lib/now-playing";
import { createJob, fetchJobs } from "../lib/pipeline-client";
import { recordingOf } from "../lib/recording";
import { expireIfUnauthorized, signOut } from "../lib/session";
import { ACTIVE_STATES } from "../lib/stages";
import { usePolling } from "../lib/use-polling";
import type { PipelineJob } from "../pipeline/contracts";
import { usePlayerInset } from "../player/inset";
import { AccountSheet } from "../screens/account-sheet";
import { LibraryScreen } from "../screens/library-screen";
import { NewNarrationSheet } from "../screens/new-narration-sheet";

const Library = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<readonly PipelineJob[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [sheet, setSheet] = useState<"add" | "account" | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const reload = usePolling(fetchJobs, {
    enabled: !busy,
    keepPolling: (list) => list.some((job) => ACTIVE_STATES.has(job.status)),
    onData: (list) => {
      setJobs(list);
      setLoadError("");
    },
    onError: (failure) => {
      if (!expireIfUnauthorized(failure)) {
        setLoadError(failure.message);
      }
    },
  });

  const create = async (url: string) => {
    setBusy(true);
    setSubmitError("");
    try {
      const job = await createJob(url);
      setSheet(null);
      await navigate({ params: { id: job.id }, to: "/narrations/$id" });
    } catch (error) {
      const failure =
        error instanceof Error ? error : new Error("The request failed.");
      if (!expireIfUnauthorized(failure)) {
        setSubmitError(failure.message);
      }
    }
    setBusy(false);
  };

  const leave = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch {
      // Still signed in; the account sheet stays open to try again.
      setBusy(false);
    }
  };

  return (
    <>
      <LibraryScreen
        jobs={jobs}
        error={loadError || undefined}
        bottomInset={usePlayerInset()}
        onRetry={() => {
          setLoadError("");
          reload();
        }}
        onAdd={() => {
          setSubmitError("");
          setSheet("add");
        }}
        onAccount={() => setSheet("account")}
        onPlay={(job) => play(recordingOf(job))}
      />
      <NewNarrationSheet
        open={sheet === "add"}
        onClose={() => setSheet(null)}
        busy={busy}
        error={submitError || undefined}
        onSubmit={(url) => {
          void create(url);
        }}
      />
      <AccountSheet
        open={sheet === "account"}
        onClose={() => setSheet(null)}
        busy={busy}
        onSignOut={() => {
          void leave();
        }}
      />
    </>
  );
};

export const Route = createFileRoute("/")({ component: Library });
