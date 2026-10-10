import { Schema } from "effect";
import { useSyncExternalStore } from "react";

import {
  playbackKey,
  readPlayback,
  validRate,
  writePlayback,
} from "./playback";
import { connectMediaSession } from "./playback-session";
import type { Recording } from "./recording";

/**
 * The app's one audio element, and what it plays. It lives for the whole
 * session and only swaps recordings, so a tap can start a recording at
 * once: Safari plays sound only when `play()` runs during the tap itself.
 */
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

const restoreRecording = (): Recording | null => {
  try {
    return Schema.decodeUnknownSync(RecordingSchema)(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
    );
  } catch {
    // Missing, blocked, or written by an older version of the app.
    return null;
  }
};

const rememberRecording = (recording: Recording | null) => {
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
  state ??= {
    expanded: false,
    failed: false,
    paused: true,
    rate: 1,
    recording: restoreRecording(),
  };
  return state;
};

const set = (next: Partial<NowPlaying>) => {
  const previous = current();
  if ("recording" in next && next.recording !== previous.recording) {
    rememberRecording(next.recording ?? null);
  }
  state = { ...previous, ...next };
  for (const listener of listeners) {
    listener();
  }
};

let audio: HTMLAudioElement | null = null;
/** The recording in the audio element, and where its place is saved. */
let loaded: { recording: Recording; key: string } | null = null;
/** The saved place, until the audio knows its length and can seek to it. */
let pending = 0;
let restored = false;
let lastSave = 0;
let mediaSession: ReturnType<typeof connectMediaSession> | null = null;

const hasDuration = (element: HTMLAudioElement) =>
  element.readyState >= 1 &&
  Number.isFinite(element.duration) &&
  element.duration > 0;

/** Saves the loaded recording's place. Never before it was restored. */
const save = () => {
  if (
    !audio ||
    !loaded ||
    !restored ||
    !hasDuration(audio) ||
    !Number.isFinite(audio.currentTime) ||
    audio.currentTime < 0
  ) {
    return;
  }
  lastSave = Date.now();
  writePlayback(loaded.key, {
    playedAt: lastSave,
    position: Math.min(audio.currentTime, audio.duration),
    rate: current().rate,
  });
};

const sync = () => {
  save();
  mediaSession?.update();
  if (audio && audio.paused !== current().paused) {
    set({ paused: audio.paused });
  }
};

/** Seeks to the saved place once the audio knows its length. */
const restore = () => {
  if (!audio || !hasDuration(audio)) {
    return;
  }
  if (!restored) {
    const { rate } = current();
    try {
      audio.currentTime = Math.min(pending, audio.duration);
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      restored = true;
    } catch {
      // Some engines only accept seeking once loadeddata or canplay fires.
      return;
    }
  }
  mediaSession?.update();
};

const rateChange = () => {
  if (audio && restored && validRate(audio.playbackRate)) {
    if (audio.defaultPlaybackRate !== audio.playbackRate) {
      audio.defaultPlaybackRate = audio.playbackRate;
    }
    set({ rate: audio.playbackRate });
    sync();
  }
};

const timeUpdate = () => {
  if (Date.now() - lastSave >= 5000) {
    save();
  }
  mediaSession?.update();
};

// play() runs before the first await, so still within the caller's tap.
const playAudio = async (element: HTMLAudioElement) => {
  try {
    await element.play();
  } catch (error) {
    // Switching recordings aborts the last play(); that is not a failure.
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      set({ failed: true });
    }
  }
};

/** Plays the loaded recording. Call it during a tap, or Safari refuses. */
export const resume = () => {
  if (audio) {
    set({ failed: false });
    void playAudio(audio);
  }
};

export const pause = () => audio?.pause();

/**
 * Puts a recording in the audio element, and plays it if asked. Switching
 * happens in one step, so the old recording keeps its own place: save it,
 * point saves at the new one, then load the new one from its saved place.
 */
const load = (recording: Recording, play: boolean) => {
  if (!audio) {
    // The audio element loads it once it is attached.
    return;
  }
  const key = playbackKey(recording);
  if (loaded?.key !== key) {
    save();
    mediaSession?.dispose();
    loaded = { key, recording };
    restored = false;
    const saved = readPlayback(key);
    pending = saved.position;
    set({ failed: false, rate: saved.rate });
    mediaSession = connectMediaSession(audio, resume, recording);
    audio.src = recording.audioUrl;
  }
  if (play) {
    resume();
  }
};

/** The recording now playing, keeping the same object if it is the same. */
const sameOrNew = (recording: Recording) => {
  const { recording: playing } = current();
  return playing?.id === recording.id && playing.version === recording.version
    ? playing
    : recording;
};

/** Loads a recording, without playing it, and opens the full player. */
export const open = (recording: Recording) => {
  load(recording, false);
  set({ expanded: true, recording: sameOrNew(recording) });
};

/** Plays a recording at once, leaving the full player as it is. */
export const listen = (recording: Recording) => {
  load(recording, true);
  set({ recording: sameOrNew(recording) });
};

/** Loads the audio again after a failure, and plays from the same place. */
export const retry = () => {
  if (!audio) {
    return;
  }
  save();
  if (restored) {
    pending = audio.currentTime;
  }
  restored = false;
  audio.load();
  // Keep play() in the tap, for browsers that require one.
  resume();
};

/**
 * Saves `position` for a recording, as when marking it finished or not
 * started, and moves the audio there if it holds the recording.
 */
export const markPosition = (recording: Recording, position: number) => {
  const key = playbackKey(recording);
  writePlayback(key, {
    playedAt: Date.now(),
    position,
    rate: readPlayback(key).rate,
  });
  if (audio && loaded?.key === key) {
    pending = position;
    if (restored && hasDuration(audio)) {
      audio.currentTime = Math.min(position, audio.duration);
    }
  }
};

export const expand = () => set({ expanded: true });
export const collapse = () => set({ expanded: false });

/** Empties the player and forgets the recording, as when signing out. */
export const stop = () => {
  save();
  mediaSession?.dispose();
  mediaSession = null;
  loaded = null;
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  set({ expanded: false, failed: false, paused: true, recording: null });
};

/**
 * Hands the app's audio element to the player, for as long as it is
 * mounted, and loads the recording that came back after a reload.
 */
export const attachAudio = (element: HTMLAudioElement) => {
  audio = element;
  audio.preservesPitch = true;
  const events = {
    canplay: restore,
    durationchange: restore,
    emptied: sync,
    ended: sync,
    error: sync,
    loadeddata: restore,
    loadedmetadata: restore,
    pause: sync,
    play: sync,
    playing: sync,
    ratechange: rateChange,
    seeked: sync,
    timeupdate: timeUpdate,
  };
  for (const [event, handler] of Object.entries(events)) {
    element.addEventListener(event, handler);
  }
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", sync);
  const { recording } = current();
  if (recording) {
    load(recording, false);
  }
  return () => {
    save();
    for (const [event, handler] of Object.entries(events)) {
      element.removeEventListener(event, handler);
    }
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("pagehide", sync);
    mediaSession?.dispose();
    mediaSession = null;
    loaded = null;
    audio = null;
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const SERVER: NowPlaying = {
  expanded: false,
  failed: false,
  paused: true,
  rate: 1,
  recording: null,
};

export const useNowPlaying = () =>
  useSyncExternalStore(subscribe, current, () => SERVER);
