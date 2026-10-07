import { Schema } from "effect";
import { useSyncExternalStore } from "react";

import type { Recording } from "./recording";

interface NowPlaying {
  readonly recording: Recording | null;
  /** Whether the full player is open. */
  readonly expanded: boolean;
}

// The last recording comes back after a reload or when iOS restarts the
// app, as in a native player. Sign-out clears it.
const STORAGE_KEY = "dyslexia:now-playing";

const RecordingSchema = Schema.Struct({
  audioUrl: Schema.String,
  durationSeconds: Schema.Number,
  id: Schema.String,
  sourceUrl: Schema.String,
  title: Schema.String,
  version: Schema.String,
});

const restore = (): Recording | null => {
  try {
    return Schema.decodeUnknownSync(RecordingSchema)(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
    );
  } catch {
    // Missing, blocked, or written by an older version of the app.
    return null;
  }
};

const save = (recording: Recording | null) => {
  try {
    if (recording) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recording));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Playback works without storage.
  }
};

let state: NowPlaying | null = null;
const listeners = new Set<() => void>();

const current = () => {
  state ??= { expanded: false, recording: restore() };
  return state;
};

const set = (next: NowPlaying) => {
  if (next.recording !== current().recording) {
    save(next.recording);
  }
  state = next;
  for (const listener of listeners) {
    listener();
  }
};

/** Loads a recording into the player and opens the full player. */
export const play = (recording: Recording) => {
  const { recording: playing } = current();
  const same =
    playing?.id === recording.id && playing.version === recording.version;
  set({ expanded: true, recording: same ? playing : recording });
};

export const expand = () => set({ ...current(), expanded: true });
export const collapse = () => set({ ...current(), expanded: false });

/** Removes the player and forgets the recording, as when signing out. */
export const stop = () => set({ expanded: false, recording: null });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const SERVER: NowPlaying = { expanded: false, recording: null };

export const useNowPlaying = () =>
  useSyncExternalStore(subscribe, current, () => SERVER);
