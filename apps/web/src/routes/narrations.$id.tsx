import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

import { play } from "../lib/now-playing";
import { approveDraft, fetchJob, submitSource } from "../lib/pipeline-client";
import { recordingOf } from "../lib/recording";
import { expireIfUnauthorized } from "../lib/session";
import { ACTIVE_STATES } from "../lib/stages";
import { usePolling } from "../lib/use-polling";
import type { JobDetail, JobStatus } from "../pipeline/contracts";
import { usePlayerInset } from "../player/inset";
import { NarrationScreen } from "../screens/narration-screen";

const route = getRouteApi("/narrations/$id");

const Narration = ({ id }: { id: string }) => {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [requestError, setRequestError] = useState("");
  const [busy, setBusy] = useState(false);
  // After a review is submitted, the job keeps its old status until the
  // server moves on. Wait for that, so the old form never shows again.
  const [submittedFrom, setSubmittedFrom] = useState<JobStatus | null>(null);

  const reload = usePolling((signal) => fetchJob(id, signal), {
    enabled: !busy,
    keepPolling: (data) =>
      ACTIVE_STATES.has(data.job.status) || data.job.status === submittedFrom,
    onData: (data) => {
      setRequestError("");
      if (data.job.status === submittedFrom) {
        return;
      }
      setSubmittedFrom(null);
      setDetail(data);
    },
    onError: (failure) => {
      if (!expireIfUnauthorized(failure)) {
        setRequestError(failure.message);
      }
    },
  });

  const submit = async (action: () => Promise<void>) => {
    const from = detail?.job.status ?? null;
    setBusy(true);
    setRequestError("");
    try {
      await action();
      setSubmittedFrom(from);
      setDetail(null);
    } catch (error) {
      const failure =
        error instanceof Error ? error : new Error("The request failed.");
      if (!expireIfUnauthorized(failure)) {
        setRequestError(failure.message);
      }
    }
    setBusy(false);
  };

  return (
    <NarrationScreen
      detail={detail}
      error={requestError || undefined}
      busy={busy}
      bottomInset={usePlayerInset()}
      onRetry={() => {
        setRequestError("");
        reload();
      }}
      onSubmitSource={(submission) => {
        void submit(() => submitSource(id, submission));
      }}
      onApprove={(submission) => {
        void submit(() => approveDraft(id, submission));
      }}
      onListen={() => {
        if (detail) {
          play(recordingOf(detail.job));
        }
      }}
    />
  );
};

// A new id starts fresh, so one narration's state never shows on another.
const NarrationRoute = () => {
  const { id } = route.useParams();
  return <Narration key={id} id={id} />;
};

export const Route = createFileRoute("/narrations/$id")({
  component: NarrationRoute,
});
