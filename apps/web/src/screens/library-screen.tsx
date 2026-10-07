import type { Narration } from "@dyslexia/narrations/client";
import {
  ActivityIndicator,
  Button,
  EmptyState,
  IconButton,
  ListButton,
  ListRow,
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

import { formatDuration, siteOf } from "../lib/recording";
import { RowIcon } from "./row-icon";

const styles = stylex.create({
  loading: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: space.huge,
  },
});

type Making = Extract<Narration, { state: "making" }>;
type Ready = Extract<Narration, { state: "ready" }>;
type Failed = Extract<Narration, { state: "failed" }>;

export interface LibraryScreenProps {
  /** `null` while the first load is in flight. */
  readonly narrations: readonly Narration[] | null;
  readonly error?: string;
  readonly onReload: () => void;
  readonly onAdd: () => void;
  readonly onAccount: () => void;
  readonly onPlay: (narration: Ready) => void;
  readonly onOpenFailed: (narration: Failed) => void;
  readonly bottomInset?: string;
}

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

/** Every narration: those being made, those ready to play, and failures. */
export const LibraryScreen = ({
  bottomInset,
  error,
  narrations,
  onAccount,
  onAdd,
  onOpenFailed,
  onPlay,
  onReload,
}: LibraryScreenProps) => {
  const making: Making[] = [];
  const ready: Ready[] = [];
  const failed: Failed[] = [];
  for (const narration of narrations ?? []) {
    if (narration.state === "making") {
      making.push(narration);
    } else if (narration.state === "ready") {
      ready.push(narration);
    } else {
      failed.push(narration);
    }
  }
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
            <Button variant="tinted" onClick={onReload}>
              Try again
            </Button>
          }
        >
          {error}
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
      {making.length > 0 && (
        <ListSection
          header="Being made"
          withIcons
          footer="You can leave the app while narrations are made."
        >
          {making.map((narration) => (
            <ListRow
              key={narration.id}
              leading={
                <RowIcon tone="neutral">
                  <ActivityIndicator />
                </RowIcon>
              }
              title={narration.title}
              subtitle={progressOf(narration)}
            />
          ))}
        </ListSection>
      )}
      {ready.length > 0 && (
        <ListSection header="Ready to listen" withIcons>
          {ready.map((narration) => (
            <ListButton
              key={narration.id}
              aria-label={`Play ${narration.title}`}
              leading={
                <RowIcon tone="accent">
                  <PlayIcon />
                </RowIcon>
              }
              title={narration.title}
              subtitle={`${siteOf(narration.url)} · ${formatDuration(narration.durationSeconds)}`}
              onClick={() => onPlay(narration)}
            />
          ))}
        </ListSection>
      )}
      {failed.length > 0 && (
        <ListSection header="Could not be made" withIcons>
          {failed.map((narration) => (
            <ListButton
              key={narration.id}
              leading={
                <RowIcon tone="danger">
                  <WarningIcon />
                </RowIcon>
              }
              title={narration.title}
              subtitle={siteOf(narration.url)}
              onClick={() => onOpenFailed(narration)}
            />
          ))}
        </ListSection>
      )}
    </Screen>
  );
};
