import type { Narration } from "@dyslexia/narrations/client";
import {
  ActivityIndicator,
  Button,
  CheckIcon,
  EmptyState,
  IconButton,
  ListSection,
  Notice,
  PlusIcon,
  Screen,
  WaveformIcon,
} from "@dyslexia/ui";
import { space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

import type { Listening } from "../lib/listening";
import { FailedRow, MakingRow, ReadyRow } from "./narration-rows";

const styles = stylex.create({
  loading: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: space.huge,
  },
});

type Ready = Extract<Narration, { state: "ready" }>;
type Failed = Extract<Narration, { state: "failed" }>;

/** How many narrations each section of Home shows at most. */
const SHOWN = 3;

/** A greeting for the time of day, such as "Good morning". */
export const greetingFor = (time: Date) => {
  const hour = time.getHours();
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }
  if (hour >= 12 && hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
};

export interface HomeScreenProps {
  /** `null` while the first load is in flight. */
  readonly narrations: readonly Narration[] | null;
  /** How far the listener got with a narration on this device. */
  readonly listeningOf: (narration: Ready) => Listening;
  /** Sets the greeting. */
  readonly now: Date;
  readonly error?: string;
  readonly onReload: () => void;
  readonly onAdd: () => void;
  readonly onPlay: (narration: Ready) => void;
  readonly onOpenFailed: (narration: Failed) => void;
  readonly bottomInset?: string;
}

/**
 * The first screen: a greeting, the narrations to pick up where the
 * listener left off, those being made, and the newest ones not started.
 */
export const HomeScreen = ({
  bottomInset,
  error,
  listeningOf,
  narrations,
  now,
  onAdd,
  onOpenFailed,
  onPlay,
  onReload,
}: HomeScreenProps) => {
  const ready = (narrations ?? []).flatMap((narration) =>
    narration.state === "ready"
      ? [{ listening: listeningOf(narration), narration }]
      : []
  );
  const resume = ready
    .filter(({ listening }) => listening.status === "in-progress")
    .toSorted((a, b) => b.listening.playedAt - a.listening.playedAt)
    .slice(0, SHOWN);
  const fresh = ready
    .filter(({ listening }) => listening.status === "not-started")
    .slice(0, SHOWN);
  const making = (narrations ?? []).filter(
    (narration) => narration.state === "making"
  );
  const failed = (narrations ?? []).filter(
    (narration) => narration.state === "failed"
  );
  const caughtUp =
    ready.length > 0 &&
    resume.length === 0 &&
    fresh.length === 0 &&
    making.length === 0 &&
    failed.length === 0;
  const addButton = (
    <Button icon={<PlusIcon />} onClick={onAdd}>
      Add article
    </Button>
  );
  return (
    <Screen
      title={greetingFor(now)}
      bottomInset={bottomInset}
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
          title="Nothing to listen to yet"
          description="Add an article link and it will be read aloud for you."
          action={addButton}
        />
      )}
      {resume.length > 0 && (
        <ListSection header="Pick up where you left off" withIcons>
          {resume.map(({ listening, narration }) => (
            <ReadyRow
              key={narration.id}
              narration={narration}
              listening={listening}
              onPlay={onPlay}
            />
          ))}
        </ListSection>
      )}
      {making.length > 0 && (
        <ListSection
          header="Being made"
          withIcons
          footer="You can leave the app while narrations are made."
        >
          {making.map((narration) => (
            <MakingRow key={narration.id} narration={narration} />
          ))}
        </ListSection>
      )}
      {failed.length > 0 && (
        <ListSection header="Could not be made" withIcons>
          {failed.map((narration) => (
            <FailedRow
              key={narration.id}
              narration={narration}
              onOpen={onOpenFailed}
            />
          ))}
        </ListSection>
      )}
      {fresh.length > 0 && (
        <ListSection header="Recently added" withIcons>
          {fresh.map(({ listening, narration }) => (
            <ReadyRow
              key={narration.id}
              narration={narration}
              listening={listening}
              onPlay={onPlay}
            />
          ))}
        </ListSection>
      )}
      {caughtUp && (
        <EmptyState
          icon={<CheckIcon />}
          title="You are all caught up"
          description="You have listened to every narration. Add an article to hear something new."
          action={addButton}
        />
      )}
    </Screen>
  );
};
