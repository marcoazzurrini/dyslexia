import type { Recording } from "./recording";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

/** Where a recording's position and speed are saved on this device. */
export const playbackKey = ({
  id,
  version,
}: Pick<Recording, "id" | "version">) => `dyslexia:playback:${id}:${version}`;

export interface SavedPlayback {
  position: number;
  rate: number;
  /** When it was last saved, in milliseconds; absent in older saves. */
  playedAt?: number;
}

export const validRate = (rate: unknown): rate is number =>
  typeof rate === "number" && PLAYBACK_RATES.some((value) => value === rate);

const isSavedPlayback = (value: unknown): value is SavedPlayback =>
  typeof value === "object" &&
  value !== null &&
  "position" in value &&
  typeof value.position === "number" &&
  Number.isFinite(value.position) &&
  value.position >= 0 &&
  "rate" in value &&
  validRate(value.rate) &&
  (!("playedAt" in value) ||
    (typeof value.playedAt === "number" && Number.isFinite(value.playedAt)));

/** The position and speed saved for a recording on this device. */
export const readPlayback = (storageKey: string): SavedPlayback => {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null"
    );
    if (isSavedPlayback(saved)) {
      return saved;
    }
  } catch {
    // Storage can be blocked, full, or contain data from an older app.
  }
  return { position: 0, rate: 1 };
};

const saveListeners = new Set<() => void>();

/** Calls `listener` whenever a position is saved, until unsubscribed. */
export const onPlaybackSaved = (listener: () => void) => {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
};

/** Saves a recording's position and speed on this device. */
export const writePlayback = (storageKey: string, saved: SavedPlayback) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved));
  } catch {
    // Playback remains usable when storage is unavailable.
    return;
  }
  for (const listener of saveListeners) {
    listener();
  }
};
