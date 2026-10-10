/**
 * Playback: one audio element for the whole session, which plays any
 * track from where the listener left it.
 *
 * It hides what makes audio on the web hard: Safari plays sound only when
 * `play()` runs during a tap, so the element lives for the whole session
 * and only swaps tracks; the audio can seek only once it knows its length;
 * each track keeps its own place and speed, saved as it plays and when the
 * page hides; and the lock screen shows what is playing and controls it.
 */
import { connectMediaSession } from "./media-session.ts";
import { readPlace, validRate, writePlace } from "./places.ts";
import { progressFrom } from "./track.ts";
import type { Progress, Track } from "./track.ts";

export { PLAYBACK_RATES } from "./places.ts";
export type { Progress, ProgressStatus, Track } from "./track.ts";

/** What is playing, as the interface shows it. */
export interface PlaybackState<T extends Track> {
  /** The loaded track, or `null` when the player is empty. */
  readonly track: T | null;
  /** Whether the audio is paused, or nothing is loaded. */
  readonly paused: boolean;
  /** The browser refused to play, such as without a tap; offer a retry. */
  readonly failed: boolean;
  readonly rate: number;
}

export interface PlaybackOptions<T extends Track> {
  /** Starts every storage key, such as the app's name. */
  readonly storagePrefix: string;
  /** Whether what an earlier visit saved is still a valid track. */
  readonly isTrack: (saved: unknown) => saved is T;
  /** Artwork for the lock screen, the same for every track. */
  readonly artwork?: readonly MediaImage[];
}

export interface Playback<T extends Track> {
  /** Calls `listener` whenever the state changes, until unsubscribed. */
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => PlaybackState<T>;
  /**
   * Plays through `element` until the returned function detaches it, and
   * loads the track an earlier visit left, without playing it.
   */
  readonly attach: (element: HTMLAudioElement) => () => void;
  /** Loads a track at its saved place, without playing it. */
  readonly load: (track: T) => void;
  /** Plays a track from its saved place. Call it during a tap. */
  readonly play: (track: T) => void;
  /** Plays the loaded track. Call it during a tap. */
  readonly resume: () => void;
  readonly pause: () => void;
  /** Loads the audio again after a failure. Call it during a tap. */
  readonly retry: () => void;
  /** Sets the speed, which the track keeps. */
  readonly setRate: (rate: number) => void;
  /** Empties the player and forgets the track, as when signing out. */
  readonly stop: () => void;
  /** How far the listener got with a track, on this device. */
  readonly progressOf: (track: Track) => Progress;
  /** Marks a track finished, or not started again. */
  readonly markFinished: (track: Track, finished: boolean) => void;
  /** Calls `listener` whenever any track's progress is saved. */
  readonly subscribeProgress: (listener: () => void) => () => void;
}

const hasDuration = (element: HTMLAudioElement) =>
  element.readyState >= 1 &&
  Number.isFinite(element.duration) &&
  element.duration > 0;

const notify = (listeners: Set<() => void>) => {
  for (const listener of listeners) {
    listener();
  }
};

const listenerSet = (listeners: Set<() => void>) => (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const createPlayback = <T extends Track>({
  artwork = [],
  isTrack,
  storagePrefix,
}: PlaybackOptions<T>): Playback<T> => {
  // The last track comes back after a reload or when iOS restarts the app,
  // as in a native player.
  const trackKey = `${storagePrefix}:now-playing`;
  const placeKey = ({ id, version }: Track) =>
    `${storagePrefix}:playback:${id}:${version}`;

  const restoreTrack = (): T | null => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(trackKey) ?? "null"
      );
      return isTrack(saved) ? saved : null;
    } catch {
      // Missing, blocked, or written by an older version.
      return null;
    }
  };

  const rememberTrack = (track: T | null) => {
    try {
      if (track) {
        localStorage.setItem(trackKey, JSON.stringify(track));
      } else {
        localStorage.removeItem(trackKey);
      }
    } catch {
      // Playback works without storage.
    }
  };

  let state: PlaybackState<T> | null = null;
  const listeners = new Set<() => void>();
  const progressListeners = new Set<() => void>();

  const current = () => {
    state ??= { failed: false, paused: true, rate: 1, track: restoreTrack() };
    return state;
  };

  const set = (next: Partial<PlaybackState<T>>) => {
    const previous = current();
    if ("track" in next && next.track !== previous.track) {
      rememberTrack(next.track ?? null);
    }
    state = { ...previous, ...next };
    notify(listeners);
  };

  const savePlace = (key: string, position: number, rate: number) => {
    if (writePlace(key, { playedAt: Date.now(), position, rate })) {
      notify(progressListeners);
    }
  };

  let audio: HTMLAudioElement | null = null;
  /** The track in the audio element, and where its place is saved. */
  let loaded: { track: T; key: string } | null = null;
  /** The saved place, until the audio knows its length and can seek. */
  let pending = 0;
  let restored = false;
  let lastSave = 0;
  let mediaSession: ReturnType<typeof connectMediaSession> | null = null;

  /** Saves the loaded track's place. Never before it was restored. */
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
    savePlace(
      loaded.key,
      Math.min(audio.currentTime, audio.duration),
      current().rate
    );
  };

  const sync = () => {
    save();
    mediaSession?.update();
    if (audio && audio.paused !== current().paused) {
      set({ paused: audio.paused });
    }
  };

  /** Seeks to the saved place once the audio knows its length. */
  const seekToPlace = () => {
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
      // Switching tracks aborts the last play(); that is not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        set({ failed: true });
      }
    }
  };

  const resume = () => {
    if (audio) {
      set({ failed: false });
      void playAudio(audio);
    }
  };

  /**
   * Puts a track in the audio element. Switching happens in one step, so
   * the old track keeps its own place: save it, point saves at the new
   * one, then load the new one from its saved place.
   */
  const loadAudio = (track: T) => {
    if (!audio) {
      // The audio element loads it once it is attached.
      return;
    }
    const key = placeKey(track);
    if (loaded?.key !== key) {
      save();
      mediaSession?.dispose();
      loaded = { key, track };
      restored = false;
      const saved = readPlace(key);
      pending = saved.position;
      set({ failed: false, rate: saved.rate });
      mediaSession = connectMediaSession(audio, resume, track, artwork);
      audio.src = track.src;
    }
  };

  /** The track now loaded, keeping the same object if it is the same. */
  const sameOrNew = (track: T) => {
    const { track: playing } = current();
    return playing?.id === track.id && playing.version === track.version
      ? playing
      : track;
  };

  const forget = () => {
    mediaSession?.dispose();
    mediaSession = null;
    loaded = null;
  };

  return {
    attach: (element) => {
      audio = element;
      audio.preservesPitch = true;
      const events = {
        canplay: seekToPlace,
        durationchange: seekToPlace,
        emptied: sync,
        ended: sync,
        error: sync,
        loadeddata: seekToPlace,
        loadedmetadata: seekToPlace,
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
      const { track } = current();
      if (track) {
        loadAudio(track);
      }
      return () => {
        save();
        for (const [event, handler] of Object.entries(events)) {
          element.removeEventListener(event, handler);
        }
        document.removeEventListener("visibilitychange", sync);
        window.removeEventListener("pagehide", sync);
        forget();
        audio = null;
      };
    },
    getSnapshot: current,
    load: (track) => {
      loadAudio(track);
      set({ track: sameOrNew(track) });
    },
    markFinished: (track, finished) => {
      const key = placeKey(track);
      const position = finished ? track.duration : 0;
      savePlace(key, position, readPlace(key).rate);
      if (audio && loaded?.key === key) {
        pending = position;
        if (restored && hasDuration(audio)) {
          audio.currentTime = Math.min(position, audio.duration);
        }
      }
    },
    pause: () => audio?.pause(),
    play: (track) => {
      loadAudio(track);
      set({ track: sameOrNew(track) });
      resume();
    },
    progressOf: (track) =>
      progressFrom(readPlace(placeKey(track)), track.duration),
    resume,
    retry: () => {
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
    },
    setRate: (rate) => {
      if (!validRate(rate)) {
        return;
      }
      set({ rate });
      if (audio) {
        audio.defaultPlaybackRate = rate;
        audio.playbackRate = rate;
      }
    },
    stop: () => {
      save();
      forget();
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      set({ failed: false, paused: true, track: null });
    },
    subscribe: listenerSet(listeners),
    subscribeProgress: listenerSet(progressListeners),
  };
};
