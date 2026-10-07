import {
  ActivityIndicator,
  Button,
  ChevronLeftIcon,
  ExternalIcon,
  Notice,
  PlayIcon,
  ProgressBar,
  Screen,
  StepList,
  Text,
  VisuallyHidden,
} from "@dyslexia/ui";
import { color, font, size, space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

import { RouterIconLink } from "../components/links";
import type {
  ApprovalSubmission,
  SourceSubmission,
} from "../lib/pipeline-client";
import { formatDuration, siteOf } from "../lib/recording";
import { ACTIVE_STATES, stepsFor } from "../lib/stages";
import type { JobDetail } from "../pipeline/contracts";
import { DraftReview } from "./draft-review";
import { SourceReview } from "./source-review";

const styles = stylex.create({
  chunks: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    paddingInline: space.lg,
  },
  heading: { display: "flex", flexDirection: "column", gap: space.xs },
  loading: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: space.huge,
  },
  note: { paddingInline: space.lg },
  section: { display: "flex", flexDirection: "column", gap: space.sm },
  sectionTitle: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    fontWeight: 600,
    paddingInline: space.lg,
  },
  source: {
    alignItems: "center",
    alignSelf: "flex-start",
    color: color.accentText,
    display: "inline-flex",
    fontSize: font.subheadline,
    gap: space.xs,
    minHeight: size.touch,
    textDecoration: "none",
  },
});

export interface NarrationScreenProps {
  /** `null` while loading. */
  readonly detail: JobDetail | null;
  readonly error?: string;
  readonly busy: boolean;
  readonly onRetry: () => void;
  readonly onSubmitSource: (submission: SourceSubmission) => void;
  readonly onApprove: (submission: ApprovalSubmission) => void;
  readonly onListen: () => void;
  readonly bottomInset?: string;
}

const Stopped = ({ detail }: { detail: JobDetail }) => (
  <Notice
    tone="danger"
    title={
      detail.job.status === "uncertain"
        ? "The outcome is uncertain"
        : "This narration could not be completed"
    }
  >
    {detail.job.status === "uncertain" && (
      <p>Speech may have been generated or billed.</p>
    )}
    {detail.job.error && <p>{detail.job.error}</p>}
    <p>
      Nothing will be retried automatically. Check the provider before starting
      another narration, to avoid paying twice.
    </p>
  </Notice>
);

const Body = ({
  busy,
  detail,
  onApprove,
  onListen,
  onSubmitSource,
}: Omit<NarrationScreenProps, "detail" | "onRetry"> & {
  detail: JobDetail;
}) => {
  const { job } = detail;
  const stopped = job.status === "failed" || job.status === "uncertain";
  return (
    <>
      <div {...stylex.props(styles.heading)}>
        <Text as="h2" variant="title1">
          {job.title || siteOf(job.url)}
        </Text>
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          {...stylex.props(styles.source)}
        >
          {siteOf(job.url)}
          <ExternalIcon />
          <VisuallyHidden>
            (opens the original article in a new tab)
          </VisuallyHidden>
        </a>
      </div>

      {job.status === "ready" && (
        <Button size="large" block icon={<PlayIcon />} onClick={onListen}>
          {job.durationSeconds
            ? `Listen · ${formatDuration(job.durationSeconds)}`
            : "Listen"}
        </Button>
      )}
      {stopped && <Stopped detail={detail} />}
      {job.status === "source_ready" && (
        <SourceReview busy={busy} detail={detail} onSubmit={onSubmitSource} />
      )}
      {job.status === "draft_ready" && (
        <DraftReview busy={busy} detail={detail} onSubmit={onApprove} />
      )}

      {!stopped && (
        <section
          aria-labelledby="progress-title"
          {...stylex.props(styles.section)}
        >
          <h3 id="progress-title" {...stylex.props(styles.sectionTitle)}>
            Progress
          </h3>
          <StepList label="Narration progress" steps={stepsFor(job.status)} />
          {job.status === "generating" && job.totalChunks > 0 && (
            <div {...stylex.props(styles.chunks)}>
              <Text variant="footnote" tone="secondary">
                Speech segments: {job.completedChunks} of {job.totalChunks}
              </Text>
              <ProgressBar
                label="Speech segments"
                value={job.completedChunks}
                max={job.totalChunks}
              />
            </div>
          )}
          {ACTIVE_STATES.has(job.status) && (
            <Text variant="footnote" tone="secondary" style={styles.note}>
              You can leave the app while the server works. This screen updates
              every few seconds while it is open.
            </Text>
          )}
        </section>
      )}
    </>
  );
};

/** One narration: its progress, the review it waits for, or its audio. */
export const NarrationScreen = ({
  bottomInset,
  detail,
  error,
  onRetry,
  ...actions
}: NarrationScreenProps) => (
  <Screen
    title="Narration"
    titleDisplay="inline"
    bottomInset={bottomInset}
    leading={
      <RouterIconLink to="/" label="Library" icon={<ChevronLeftIcon />} />
    }
  >
    {error && (
      <Notice
        tone="danger"
        announce
        title="Something went wrong"
        action={
          <Button variant="tinted" onClick={onRetry}>
            Refresh status
          </Button>
        }
      >
        {error} Nothing will be resubmitted automatically. Refresh the status
        before trying again.
      </Notice>
    )}
    {detail ? (
      <Body detail={detail} {...actions} />
    ) : (
      !error && (
        <div {...stylex.props(styles.loading)}>
          <ActivityIndicator size="large" label="Loading narration" />
        </div>
      )
    )}
  </Screen>
);
