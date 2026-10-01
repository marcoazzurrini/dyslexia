import { ARTICLE } from "./article";
import { connectMediaSession } from "./playback-session";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export const PLAYBACK_STORAGE_KEY = `dyslexia:playback:${ARTICLE.id}:${ARTICLE.version}`;

interface SavedPlayback {
  position: number;
  rate: number;
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

// Video.js owns playback state and controls. This adapter only manages the
// application's saved position, preferred speed, and optional system controls.
export const connectPlayback = (
  audio: HTMLAudioElement,
  { onRate, play }: { onRate: (rate: number) => void; play: () => void }
) => {
  const saved = readPlayback();
  let pendingPosition = saved.position;
  let { rate } = saved;
  let restored = false;
  let lastSave = 0;

  const hasDuration = () =>
    audio.readyState >= 1 &&
    Number.isFinite(audio.duration) &&
    audio.duration > 0;

  const save = () => {
    // Events can precede metadata. Never overwrite a pending saved position.
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
      // Playback remains usable when storage is unavailable.
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
    if (!restored) {
      try {
        audio.currentTime = Math.min(pendingPosition, audio.duration);
        audio.defaultPlaybackRate = rate;
        audio.playbackRate = rate;
        restored = true;
      } catch {
        // Some engines only accept restoration once loadeddata/canplay fires.
        return;
      }
    }
    mediaSession.update();
  };
  const rateChange = () => {
    if (restored && validRate(audio.playbackRate)) {
      rate = audio.playbackRate;
      if (audio.defaultPlaybackRate !== rate) {
        audio.defaultPlaybackRate = rate;
      }
      onRate(rate);
      sync();
    }
  };
  const timeUpdate = () => {
    if (Date.now() - lastSave >= 5000) {
      save();
    }
    mediaSession.update();
  };
  const events = {
    canplay: metadata,
    durationchange: metadata,
    ended: sync,
    error: sync,
    loadeddata: metadata,
    loadedmetadata: metadata,
    pause: sync,
    playing: sync,
    ratechange: rateChange,
    seeked: sync,
    timeupdate: timeUpdate,
  };
  for (const [event, handler] of Object.entries(events)) {
    audio.addEventListener(event, handler);
  }
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", sync);
  audio.preservesPitch = true;
  onRate(rate);
  metadata();

  const retry = () => {
    save();
    if (restored) {
      pendingPosition = audio.currentTime;
    }
    restored = false;
    audio.load();
    // Keep play() in the click call stack for browsers requiring activation.
    play();
  };
  const dispose = () => {
    save();
    for (const [event, handler] of Object.entries(events)) {
      audio.removeEventListener(event, handler);
    }
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("pagehide", sync);
    mediaSession.dispose();
  };

  return { dispose, retry };
};
