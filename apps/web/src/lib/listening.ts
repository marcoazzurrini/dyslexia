import type { Narration } from "@dyslexia/narrations/client";
import type { Progress, ProgressStatus } from "@dyslexia/playback";
import { useSyncExternalStore } from "react";

import { playback } from "./now-playing";
import { recordingOf } from "./recording";

type Ready = Extract<Narration, { state: "ready" }>;

/** How far the listener got with a narration, on this device. */
export type Listening = Progress;
export type ListeningStatus = ProgressStatus;

/** How far the listener got with a narration, from its saved place. */
export const listeningOf = (narration: Ready): Listening =>
  playback.progressOf(recordingOf(narration));

/** Marks a narration finished, or not started again, on this device. */
export const markFinished = (narration: Ready, finished: boolean) =>
  playback.markFinished(recordingOf(narration), finished);

let version = 0;
const subscribe = (listener: () => void) =>
  playback.subscribeProgress(() => {
    version += 1;
    listener();
  });

/**
 * Reads how far the listener got with each narration, and renders again
 * whenever the player saves a place.
 */
export const useListening = () => {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0
  );
  return listeningOf;
};
