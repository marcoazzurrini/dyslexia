import type { Narration } from "@dyslexia/narrations/client";
import { useSyncExternalStore } from "react";

import { onPlaybackSaved, playbackKey, readPlayback } from "./playback";
import { recordingOf } from "./recording";

type Ready = Extract<Narration, { state: "ready" }>;

/** How far the listener got with a narration, on this device. */
export type ListeningStatus = "not-started" | "in-progress" | "finished";

export interface Listening {
  readonly status: ListeningStatus;
  /** Seconds listened to. */
  readonly position: number;
  /** Seconds left to listen to. */
  readonly remaining: number;
  /** When it was last listened to, in milliseconds, or 0 if never. */
  readonly playedAt: number;
}

// Stopping in the last few seconds still counts as listening to the end.
const finishMargin = (duration: number) => Math.min(30, duration * 0.05);

/** How far the listener got with a narration, from its saved position. */
export const listeningOf = (narration: Ready): Listening => {
  const { playedAt = 0, position } = readPlayback(
    playbackKey(recordingOf(narration))
  );
  const duration = narration.durationSeconds;
  let status: ListeningStatus = "in-progress";
  if (position <= 0) {
    status = "not-started";
  } else if (position >= duration - finishMargin(duration)) {
    status = "finished";
  }
  return {
    playedAt,
    position,
    remaining: Math.max(0, duration - position),
    status,
  };
};

let version = 0;
const listeners = new Set<() => void>();
onPlaybackSaved(() => {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Reads how far the listener got with each narration, and renders again
 * whenever the player saves a position.
 */
export const useListening = () => {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0
  );
  return listeningOf;
};
