import {
  ActivityIndicator,
  Button,
  EmptyState,
  IconButton,
  InfoIcon,
  ListButton,
  ListSection,
  Notice,
  PersonIcon,
  PlayIcon,
  PlusIcon,
  Screen,
  WarningIcon,
  WaveformIcon,
} from "@dyslexia/ui";
import { space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

import { RouterListLink } from "../components/links";
import { formatDuration, siteOf } from "../lib/recording";
import { ACTIVE_STATES, REVIEW_STATES, stageLabel } from "../lib/stages";
import type { PipelineJob } from "../pipeline/contracts";
import { RowIcon } from "./row-icon";

const styles = stylex.create({
  loading: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: space.huge,
  },
});

export interface LibraryScreenProps {
  /** `null` while the first load is in flight. */
  readonly jobs: readonly PipelineJob[] | null;
  readonly error?: string;
  readonly onRetry: () => void;
  readonly onAdd: () => void;
  readonly onAccount: () => void;
  readonly onPlay: (job: PipelineJob) => void;
  readonly bottomInset?: string;
}

const isStopped = (job: PipelineJob) =>
  job.status === "failed" || job.status === "uncertain";

const iconFor = (job: PipelineJob) => {
  if (isStopped(job)) {
    return (
      <RowIcon tone="danger">
        <WarningIcon />
      </RowIcon>
    );
  }
  if (REVIEW_STATES.has(job.status)) {
    return (
      <RowIcon tone="accent">
        <InfoIcon />
      </RowIcon>
    );
  }
  return (
    <RowIcon tone="neutral">
      <ActivityIndicator />
    </RowIcon>
  );
};

const JobLink = ({ job }: { job: PipelineJob }) => {
  const icon = iconFor(job);
  return (
    <RouterListLink
      to="/narrations/$id"
      params={{ id: job.id }}
      leading={icon}
      title={job.title || siteOf(job.url)}
      subtitle={stageLabel(job.status)}
    />
  );
};

/** Every narration, grouped by what it needs next. */
export const LibraryScreen = ({
  bottomInset,
  error,
  jobs,
  onAccount,
  onAdd,
  onPlay,
  onRetry,
}: LibraryScreenProps) => {
  const review = jobs?.filter((job) => REVIEW_STATES.has(job.status)) ?? [];
  const working = jobs?.filter((job) => ACTIVE_STATES.has(job.status)) ?? [];
  const ready = jobs?.filter((job) => job.status === "ready") ?? [];
  const stopped = jobs?.filter(isStopped) ?? [];
  return (
    <Screen
      title="Library"
      bottomInset={bottomInset}
      leading={
        <IconButton label="Account" icon={<PersonIcon />} onClick={onAccount} />
      }
      trailing={
        <IconButton label="Add article" icon={<PlusIcon />} onClick={onAdd} />
      }
    >
      {error && (
        <Notice
          tone="danger"
          announce
          title="Could not load narrations"
          action={
            <Button variant="tinted" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {error} Nothing was resubmitted.
        </Notice>
      )}
      {!jobs && !error && (
        <div {...stylex.props(styles.loading)}>
          <ActivityIndicator size="large" label="Loading narrations" />
        </div>
      )}
      {jobs?.length === 0 && (
        <EmptyState
          icon={<WaveformIcon />}
          title="No narrations yet"
          description="Add an article link to make your first narration."
          action={
            <Button icon={<PlusIcon />} onClick={onAdd}>
              Add article
            </Button>
          }
        />
      )}
      {review.length > 0 && (
        <ListSection header="Needs your review" withIcons>
          {review.map((job) => (
            <JobLink key={job.id} job={job} />
          ))}
        </ListSection>
      )}
      {working.length > 0 && (
        <ListSection
          header="In progress"
          withIcons
          footer="You can leave the app while narrations are made."
        >
          {working.map((job) => (
            <JobLink key={job.id} job={job} />
          ))}
        </ListSection>
      )}
      {ready.length > 0 && (
        <ListSection header="Ready to listen" withIcons>
          {ready.map((job) => (
            <ListButton
              key={job.id}
              aria-label={`Play ${job.title || siteOf(job.url)}`}
              leading={
                <RowIcon tone="accent">
                  <PlayIcon />
                </RowIcon>
              }
              title={job.title || siteOf(job.url)}
              subtitle={
                job.durationSeconds
                  ? `${siteOf(job.url)} · ${formatDuration(job.durationSeconds)}`
                  : siteOf(job.url)
              }
              onClick={() => onPlay(job)}
            />
          ))}
        </ListSection>
      )}
      {stopped.length > 0 && (
        <ListSection header="Stopped" withIcons>
          {stopped.map((job) => (
            <JobLink key={job.id} job={job} />
          ))}
        </ListSection>
      )}
    </Screen>
  );
};
