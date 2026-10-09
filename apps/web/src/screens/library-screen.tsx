import type { Narration } from "@dyslexia/narrations/client";
import {
  ActivityIndicator,
  Button,
  EmptyState,
  IconButton,
  ListSection,
  Notice,
  PlusIcon,
  Screen,
  SegmentedControl,
  WaveformIcon,
} from "@dyslexia/ui";
import { media, motion, space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import type { Listening, ListeningStatus } from "../lib/listening";
import { FailedRow, MakingRow, ReadyRow } from "./narration-rows";

const appear = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(6px)" },
  to: { opacity: 1, transform: "none" },
});

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const styles = stylex.create({
  loading: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: space.huge,
  },
  results: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxl,
  },
  // A new filter's rows settle in, so the change reads as a change.
  settle: {
    animationDuration: motion.regular,
    animationName: { default: appear, [media.reducedMotion]: fadeIn },
    animationTimingFunction: motion.easeOut,
  },
});

type Making = Extract<Narration, { state: "making" }>;
type Ready = Extract<Narration, { state: "ready" }>;
type Failed = Extract<Narration, { state: "failed" }>;

/** Which narrations the library shows. */
export type LibraryFilter = "all" | ListeningStatus;

const FILTERS: readonly { value: LibraryFilter; label: string }[] = [
  { label: "All", value: "all" },
  { label: "Not started", value: "not-started" },
  { label: "In progress", value: "in-progress" },
  { label: "Finished", value: "finished" },
];

const NOTHING: Record<ListeningStatus, { title: string; description: string }> =
  {
    finished: {
      description: "Narrations you listen to the end appear here.",
      title: "Nothing finished yet",
    },
    "in-progress": {
      description: "Narrations you have started listening to appear here.",
      title: "Nothing in progress",
    },
    "not-started": {
      description: "You have started every narration.",
      title: "Nothing new",
    },
  };

export interface LibraryScreenProps {
  /** `null` while the first load is in flight. */
  readonly narrations: readonly Narration[] | null;
  readonly filter: LibraryFilter;
  readonly onFilter: (filter: LibraryFilter) => void;
  /** How far the listener got with a narration on this device. */
  readonly listeningOf: (narration: Ready) => Listening;
  readonly error?: string;
  readonly onReload: () => void;
  readonly onAdd: () => void;
  readonly onPlay: (narration: Ready) => void;
  readonly onOpenFailed: (narration: Failed) => void;
  /** Opens the options for a ready narration, such as Delete. */
  readonly onOptions: (narration: Ready) => void;
  readonly onDelete: (narration: Ready | Failed) => void;
  /** Why the last deletion failed. */
  readonly deleteError?: string;
  readonly bottomInset?: string;
}

type RowActions = Pick<
  LibraryScreenProps,
  "onDelete" | "onOpenFailed" | "onOptions" | "onPlay"
>;

/** The narrations one filter shows. */
const Results = ({
  changed,
  filter,
  listeningOf,
  narrations,
  onDelete,
  onOpenFailed,
  onOptions,
  onPlay,
}: RowActions & {
  filter: LibraryFilter;
  listeningOf: LibraryScreenProps["listeningOf"];
  narrations: readonly Narration[];
  /** The listener just chose this filter. */
  changed: boolean;
}) => {
  const making: Making[] = [];
  const ready: { narration: Ready; listening: Listening }[] = [];
  const failed: Failed[] = [];
  for (const narration of narrations) {
    if (narration.state === "making") {
      making.push(narration);
    } else if (narration.state === "ready") {
      const listening = listeningOf(narration);
      if (filter === "all" || listening.status === filter) {
        ready.push({ listening, narration });
      }
    } else {
      failed.push(narration);
    }
  }
  const all = filter === "all";
  return (
    <div {...stylex.props(styles.results, changed && styles.settle)}>
      {all && making.length > 0 && (
        <ListSection
          header="Being made"
          plain
          prominent
          withIcons
          footer="You can leave the app while narrations are made."
        >
          {making.map((narration) => (
            <MakingRow key={narration.id} narration={narration} />
          ))}
        </ListSection>
      )}
      {ready.length > 0 && (
        <ListSection
          header={all ? "Ready to listen" : undefined}
          plain
          prominent
          withIcons
        >
          {ready.map(({ listening, narration }) => (
            <ReadyRow
              key={narration.id}
              narration={narration}
              listening={listening}
              onPlay={onPlay}
              onOptions={onOptions}
              onDelete={onDelete}
            />
          ))}
        </ListSection>
      )}
      {all && failed.length > 0 && (
        <ListSection header="Could not be made" plain prominent withIcons>
          {failed.map((narration) => (
            <FailedRow
              key={narration.id}
              narration={narration}
              onOpen={onOpenFailed}
              onDelete={onDelete}
            />
          ))}
        </ListSection>
      )}
      {!all && ready.length === 0 && (
        <EmptyState
          title={NOTHING[filter].title}
          description={NOTHING[filter].description}
        />
      )}
    </div>
  );
};

/**
 * Every narration, filtered by how far the listener got. "All" also shows
 * narrations being made and those that could not be made.
 */
export const LibraryScreen = ({
  bottomInset,
  deleteError,
  error,
  filter,
  listeningOf,
  narrations,
  onAdd,
  onDelete,
  onFilter,
  onOpenFailed,
  onOptions,
  onPlay,
  onReload,
}: LibraryScreenProps) => {
  // Opening the library shows it at once; only a chosen filter animates.
  const [chosen, setChosen] = useState(false);
  return (
    <Screen
      title="Library"
      background="plain"
      bottomInset={bottomInset}
      trailing={
        <IconButton
          label="Add article"
          icon={<PlusIcon />}
          variant="tinted"
          onClick={onAdd}
        />
      }
    >
      {error && (
        <Notice
          tone="danger"
          announce
          title="Could not load narrations"
          action={
            <Button variant="tinted" onClick={onReload}>
              Try again
            </Button>
          }
        >
          {error}
        </Notice>
      )}
      {deleteError && (
        <Notice tone="danger" announce title="Could not delete the narration">
          {deleteError}
        </Notice>
      )}
      {!narrations && !error && (
        <div {...stylex.props(styles.loading)}>
          <ActivityIndicator size="large" label="Loading narrations" />
        </div>
      )}
      {narrations?.length === 0 && (
        <EmptyState
          icon={<WaveformIcon />}
          title="No narrations yet"
          description="Add an article link and it will be read aloud for you."
          action={
            <Button icon={<PlusIcon />} onClick={onAdd}>
              Add article
            </Button>
          }
        />
      )}
      {narrations && narrations.length > 0 && (
        <>
          <SegmentedControl
            label="Show"
            options={FILTERS}
            value={filter}
            onChange={(next) => {
              setChosen(true);
              onFilter(next);
            }}
          />
          <Results
            key={filter}
            changed={chosen}
            filter={filter}
            listeningOf={listeningOf}
            narrations={narrations}
            onDelete={onDelete}
            onOpenFailed={onOpenFailed}
            onOptions={onOptions}
            onPlay={onPlay}
          />
        </>
      )}
    </Screen>
  );
};
