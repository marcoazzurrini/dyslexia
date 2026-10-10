import type { Narration } from "@dyslexia/narrations/client";
import {
  ActivityIndicator,
  Cover,
  coverTint,
  ListButton,
  ListRow,
  MediaCard,
  MediaTile,
  PauseIcon,
  PlayIcon,
  WarningIcon,
} from "@dyslexia/ui";
import type { RowMeta } from "@dyslexia/ui";

import type { Listening } from "../lib/listening";
import { coverOf, formatDuration, siteOf } from "../lib/recording";

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

/** How far the listener got: the length, the time left, or Finished. */
const metaOf = (narration: Ready, listening: Listening): RowMeta => {
  if (listening.status === "finished") {
    return { done: true, text: "Finished" };
  }
  if (listening.status === "not-started") {
    return { text: formatDuration(narration.durationSeconds) };
  }
  return {
    progress: listening.position / narration.durationSeconds,
    text: `${formatDuration(listening.remaining)} left`,
  };
};

/** A narration being made, with what it is doing. */
export const MakingRow = ({ narration }: { narration: Making }) => (
  <ListRow
    leading={
      <Cover {...coverOf(narration.url)} tone="neutral">
        <ActivityIndicator />
      </Cover>
    }
    title={narration.title}
    subtitle={progressOf(narration)}
  />
);

export interface ReadyRowProps {
  readonly narration: Ready;
  readonly listening: Listening;
  /** It is playing now, so its button pauses it. */
  readonly playing: boolean;
  /** Pressing the row opens the full player. */
  readonly onOpen: (narration: Ready) => void;
  /** Its Play button plays it at once, leaving the player closed. */
  readonly onListen: (narration: Ready) => void;
  readonly onPause: () => void;
  /** Offers Delete by swiping and through the more button. */
  readonly onOptions?: (narration: Ready) => void;
  readonly onDelete?: (narration: Ready) => void;
}

/**
 * A narration ready to play, with how far the listener got. Pressing it
 * opens the player; its button plays or pauses it in place, as in Audible.
 */
export const ReadyRow = ({
  listening,
  narration,
  onDelete,
  onListen,
  onOpen,
  onOptions,
  onPause,
  playing,
}: ReadyRowProps) => (
  <ListButton
    leading={<Cover {...coverOf(narration.url)} />}
    title={narration.title}
    subtitle={siteOf(narration.url)}
    meta={metaOf(narration, listening)}
    onClick={() => onOpen(narration)}
    swipeAction={
      onDelete && { label: "Delete", onAction: () => onDelete(narration) }
    }
    action={
      playing
        ? {
            icon: <PauseIcon />,
            label: `Pause ${narration.title}`,
            onClick: onPause,
          }
        : {
            icon: <PlayIcon />,
            label: `Play ${narration.title}`,
            onClick: () => onListen(narration),
          }
    }
    more={
      onOptions && {
        label: `Options for ${narration.title}`,
        onClick: () => onOptions(narration),
      }
    }
  />
);

/** A narration to pick up, as a card in a darker shade of its cover's color. */
export const ResumeCard = ({
  listening,
  narration,
  onOpen,
  wide = false,
}: {
  narration: Ready;
  listening: Listening;
  onOpen: (narration: Ready) => void;
  /** Spans the screen, when it is the only card on its shelf. */
  wide?: boolean;
}) => (
  <MediaCard
    label={narration.title}
    artwork={<Cover {...coverOf(narration.url)} />}
    title={narration.title}
    meta={`${siteOf(narration.url)} · ${formatDuration(listening.remaining)} left`}
    progress={listening.position / narration.durationSeconds}
    tint={coverTint(siteOf(narration.url))}
    wide={wide}
    onClick={() => onOpen(narration)}
  />
);

/** A narration on a shelf: its cover, title, and length. */
export const ShelfTile = ({
  narration,
  onOpen,
}: {
  narration: Ready;
  onOpen: (narration: Ready) => void;
}) => (
  <MediaTile
    label={narration.title}
    artwork={<Cover {...coverOf(narration.url)} />}
    title={narration.title}
    meta={`${siteOf(narration.url)} · ${formatDuration(narration.durationSeconds)}`}
    onClick={() => onOpen(narration)}
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
      <Cover {...coverOf(narration.url)} tone="danger">
        <WarningIcon />
      </Cover>
    }
    title={narration.title}
    subtitle={siteOf(narration.url)}
    onClick={() => onOpen(narration)}
    swipeAction={
      onDelete && { label: "Delete", onAction: () => onDelete(narration) }
    }
  />
);
