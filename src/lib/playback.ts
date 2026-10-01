import { ARTICLE } from "./article";
import { connectMediaSession } from "./playback-session";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export const PLAYBACK_STORAGE_KEY = `dyslexia:playback:${ARTICLE.id}:${ARTICLE.version}`;

interface SavedPlayback {
  position: number;
  rate: number;
}

export type PlaybackStatus =
  | "ready"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error";

interface PlaybackCallbacks {
  onRate: (rate: number) => void;
  onReady: (ready: boolean) => void;
  onStatus: (status: PlaybackStatus) => void;
}

const validRate = (rate: unknown): rate is number =>
  typeof rate === "number" && PLAYBACK_RATES.some((value) => value === rate);

const isSavedPlayback = (value: unknown): value is SavedPlayback =>
  typeof value === "object" &&
  value !== null &&
  "position" in value &&
  typeof value.position === "number" &&
  Number.isFinite(value.position) &&
  value.position >= 0 &&
  "rate" in value &&
  validRate(value.rate);

const readPlayback = (): SavedPlayback => {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(PLAYBACK_STORAGE_KEY) ?? "null"
    );
    if (isSavedPlayback(saved)) {
      return saved;
    }
  } catch {
    // Storage can be blocked, full, or contain data from an older app.
  }
  return { position: 0, rate: 1 };
};

export const connectPlayback = (
  audio: HTMLAudioElement,
  { onRate, onReady, onStatus }: PlaybackCallbacks
) => {
  const saved = readPlayback();
  let pendingPosition = saved.position;
  let { rate } = saved;
  let restored = false;
  let disposed = false;
  let lastSave = 0;

  const hasDuration = () =>
    audio.readyState >= 1 &&
    Number.isFinite(audio.duration) &&
    audio.duration > 0;

  const save = () => {
    // In particular, ratechange and visibility events can precede metadata.
    // Never replace a pending saved position with the initial currentTime of 0.
    if (
      !restored ||
      !hasDuration() ||
      !Number.isFinite(audio.currentTime) ||
      audio.currentTime < 0
    ) {
      return;
    }
    lastSave = Date.now();
    try {
      localStorage.setItem(
        PLAYBACK_STORAGE_KEY,
        JSON.stringify({
          position: Math.min(audio.currentTime, audio.duration),
          rate,
        })
      );
    } catch {
      // Playback remains usable when browser storage is unavailable.
    }
  };

  const play = async () => {
    onStatus("loading");
    try {
      await audio.play();
    } catch (error) {
      if (
        disposed ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }
      onStatus("error");
    }
  };

  const mediaSession = connectMediaSession(audio, play);
  const sync = () => {
    save();
    mediaSession.update();
  };
  const metadata = () => {
    if (!hasDuration()) {
      return;
    }
    audio.preservesPitch = true;
    if (!restored) {
      try {
        audio.currentTime = Math.min(pendingPosition, audio.duration);
        // Rate changes can seek the decoder too. Do not apply the saved rate
        // before valid metadata exists, especially with delayed media loads.
        audio.defaultPlaybackRate = rate;
        audio.playbackRate = rate;
        restored = true;
      } catch {
        // Some engines only accept a seek once loadeddata/canplay fires.
        return;
      }
    }
    onReady(true);
    mediaSession.update();
    if (audio.paused) {
      onStatus("ready");
    }
  };
  const canPlay = () => {
    metadata();
    onStatus(audio.paused ? "ready" : "playing");
  };
  const playing = () => {
    onStatus("playing");
    mediaSession.update();
  };
  const pause = () => {
    if (!audio.error) {
      onStatus(audio.ended ? "ended" : "paused");
    }
    sync();
  };
  const timeUpdate = () => {
    if (Date.now() - lastSave >= 5000) {
      save();
    }
    mediaSession.update();
  };
  const rateChange = () => {
    if (restored && validRate(audio.playbackRate)) {
      rate = audio.playbackRate;
      if (audio.defaultPlaybackRate !== rate) {
        audio.defaultPlaybackRate = rate;
      }
      audio.preservesPitch = true;
      onRate(rate);
      sync();
    }
  };
  const loading = () => onStatus("loading");
  const error = () => {
    onStatus("error");
    mediaSession.update();
  };
  const ended = () => {
    onStatus("ended");
    sync();
  };
  const events = {
    canplay: canPlay,
    durationchange: metadata,
    ended,
    error,
    loadeddata: metadata,
    loadedmetadata: metadata,
    loadstart: loading,
    pause,
    playing,
    ratechange: rateChange,
    seeked: sync,
    timeupdate: timeUpdate,
    waiting: loading,
  };
  for (const [event, handler] of Object.entries(events)) {
    audio.addEventListener(event, handler);
  }
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", sync);
  audio.preservesPitch = true;
  onRate(rate);
  metadata();
  if (audio.error) {
    error();
  }

  const retry = () => {
    save();
    if (restored) {
      pendingPosition = audio.currentTime;
    }
    restored = false;
    onReady(false);
    audio.load();
    // Keep play() in the click call stack for browsers requiring activation.
    play();
  };
  const dispose = () => {
    save();
    disposed = true;
    for (const [event, handler] of Object.entries(events)) {
      audio.removeEventListener(event, handler);
    }
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("pagehide", sync);
    mediaSession.dispose();
  };

  return { dispose, play, retry };
};
