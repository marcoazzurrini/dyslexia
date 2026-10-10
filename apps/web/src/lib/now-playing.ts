import { createPlayback } from "@dyslexia/playback";
import type { PlaybackState } from "@dyslexia/playback";
import { Schema } from "effect";
import { useSyncExternalStore } from "react";

import type { Recording } from "./recording";

const RecordingSchema = Schema.Struct({
  artist: Schema.String,
  duration: Schema.Number,
  id: Schema.String,
  sourceUrl: Schema.String,
  src: Schema.String,
  title: Schema.String,
  version: Schema.String,
});

/**
 * The app's player. Its audio element lives in `<Player>`, for the whole
 * session, so a tap can start any recording at once.
 */
export const playback = createPlayback<Recording>({
  artwork: [
    { sizes: "192x192", src: "/icons/icon-192.png", type: "image/png" },
    { sizes: "512x512", src: "/icons/icon-512.png", type: "image/png" },
  ],
  isTrack: Schema.is(RecordingSchema),
  storagePrefix: "dyslexia",
});

// Whether the full player is open; the mini player shows otherwise.
let expanded = false;
const listeners = new Set<() => void>();

const setExpanded = (next: boolean) => {
  expanded = next;
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Loads a recording, without playing it, and opens the full player. */
export const open = (recording: Recording) => {
  playback.load(recording);
  setExpanded(true);
};

export const expand = () => setExpanded(true);
export const collapse = () => setExpanded(false);

/** Empties the player and forgets the recording, as when signing out. */
export const stop = () => {
  playback.stop();
  setExpanded(false);
};

export interface NowPlaying {
  readonly recording: Recording | null;
  /** Whether the full player is open. */
  readonly expanded: boolean;
  /** Whether the audio is paused, or nothing is loaded. */
  readonly paused: boolean;
  /** The browser refused to play, such as without a tap; offer a retry. */
  readonly failed: boolean;
  readonly rate: number;
}

const SERVER: PlaybackState<Recording> = {
  failed: false,
  paused: true,
  rate: 1,
  track: null,
};

export const useNowPlaying = (): NowPlaying => {
  const { failed, paused, rate, track } = useSyncExternalStore(
    playback.subscribe,
    playback.getSnapshot,
    () => SERVER
  );
  const isExpanded = useSyncExternalStore(
    subscribe,
    () => expanded,
    () => false
  );
  return { expanded: isExpanded, failed, paused, rate, recording: track };
};
