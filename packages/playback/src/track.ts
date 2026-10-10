import type { Place } from "./places.ts";

/** Something to listen to. */
export interface Track {
  readonly id: string;
  /** Changes when the audio changes; each version keeps its own place. */
  readonly version: string;
  /** The audio's address. */
  readonly src: string;
  readonly title: string;
  /** Shown under the title on the lock screen, such as the source. */
  readonly artist: string;
  /** Its length in seconds, known before the audio loads. */
  readonly duration: number;
}

/** How far the listener got with a track. */
export type ProgressStatus = "not-started" | "in-progress" | "finished";

/** How far the listener got with a track, on this device. */
export interface Progress {
  readonly status: ProgressStatus;
  /** Seconds listened to. */
  readonly position: number;
  /** Seconds left to listen to. */
  readonly remaining: number;
  /** When it was last listened to, in milliseconds, or 0 if never. */
  readonly playedAt: number;
}

// Stopping in the last few seconds still counts as listening to the end.
const finishMargin = (duration: number) => Math.min(30, duration * 0.05);

export const progressFrom = (
  { playedAt = 0, position }: Place,
  duration: number
): Progress => {
  let status: ProgressStatus = "in-progress";
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
