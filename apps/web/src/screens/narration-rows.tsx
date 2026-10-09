import type { Narration } from "@dyslexia/narrations/client";
import {
  ActivityIndicator,
  CheckIcon,
  EllipsisIcon,
  IconButton,
  ListButton,
  ListRow,
  PlayIcon,
  ProgressBar,
  WarningIcon,
} from "@dyslexia/ui";
import { space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

import type { Listening } from "../lib/listening";
import { formatDuration, siteOf } from "../lib/recording";
import { RowIcon } from "./row-icon";

const styles = stylex.create({
  progress: { display: "block", paddingTop: space.xs },
});

type Making = Extract<Narration, { state: "making" }>;
type Ready = Extract<Narration, { state: "ready" }>;
type Failed = Extract<Narration, { state: "failed" }>;

/** What a narration in progress is doing, such as "Recording 3 of 8". */
export const progressOf = ({ progress, stage }: Making) => {
  if (stage === "reading") {
    return "Reading the article…";
  }
  if (stage === "writing") {
    return "Writing the narration…";
  }
  return progress
    ? `Recording ${progress.done} of ${progress.total}…`
    : "Recording…";
};

/** A narration being made, with what it is doing. */
export const MakingRow = ({ narration }: { narration: Making }) => (
  <ListRow
    leading={
      <RowIcon tone="neutral">
        <ActivityIndicator />
      </RowIcon>
    }
    title={narration.title}
    subtitle={progressOf(narration)}
  />
);

/** How far the listener got, under a ready narration's title. */
const ListeningLine = ({
  listening,
  narration,
}: {
  listening: Listening;
  narration: Ready;
}) => {
  const site = siteOf(narration.url);
  if (listening.status === "finished") {
    return <>{site} · Finished</>;
  }
  if (listening.status === "not-started") {
    return (
      <>
        {site} · {formatDuration(narration.durationSeconds)}
      </>
    );
  }
  return (
    <>
      {site} · {formatDuration(listening.remaining)} left
      <span {...stylex.props(styles.progress)}>
        <ProgressBar
          label="Listened"
          size="thin"
          value={listening.position}
          max={narration.durationSeconds}
        />
      </span>
    </>
  );
};

export interface ReadyRowProps {
  readonly narration: Ready;
  readonly listening: Listening;
  readonly onPlay: (narration: Ready) => void;
  /** Offers Delete by swiping and through an options button. */
  readonly onOptions?: (narration: Ready) => void;
  readonly onDelete?: (narration: Ready) => void;
}

/** A narration ready to play, with how far the listener got. */
export const ReadyRow = ({
  listening,
  narration,
  onDelete,
  onOptions,
  onPlay,
}: ReadyRowProps) => (
  <ListButton
    aria-label={`Play ${narration.title}`}
    leading={
      listening.status === "finished" ? (
        <RowIcon tone="neutral">
          <CheckIcon />
        </RowIcon>
      ) : (
        <RowIcon tone="accent">
          <PlayIcon />
        </RowIcon>
      )
    }
    title={narration.title}
    subtitle={<ListeningLine listening={listening} narration={narration} />}
    onClick={() => onPlay(narration)}
    swipeAction={
      onDelete && { label: "Delete", onAction: () => onDelete(narration) }
    }
    trailing={
      onOptions && (
        <IconButton
          label={`Options for ${narration.title}`}
          icon={<EllipsisIcon />}
          variant="plain"
          onClick={() => onOptions(narration)}
        />
      )
    }
  />
);

/** A narration that could not be made. Pressing it explains why. */
export const FailedRow = ({
  narration,
  onDelete,
  onOpen,
}: {
  narration: Failed;
  onOpen: (narration: Failed) => void;
  onDelete?: (narration: Failed) => void;
}) => (
  <ListButton
    leading={
      <RowIcon tone="danger">
        <WarningIcon />
      </RowIcon>
    }
    title={narration.title}
    subtitle={siteOf(narration.url)}
    onClick={() => onOpen(narration)}
    swipeAction={
      onDelete && { label: "Delete", onAction: () => onDelete(narration) }
    }
  />
);
