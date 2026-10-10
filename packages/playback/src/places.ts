/** The speeds a listener can choose from. */
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

/** Where a listener left a track, and at what speed. */
export interface Place {
  readonly position: number;
  readonly rate: number;
  /** When it was saved, in milliseconds; absent in older saves. */
  readonly playedAt?: number;
}

export const validRate = (rate: unknown): rate is number =>
  typeof rate === "number" && PLAYBACK_RATES.some((value) => value === rate);

const isPlace = (value: unknown): value is Place =>
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

/** The place saved under `key` on this device, or the start. */
export const readPlace = (key: string): Place => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (isPlace(saved)) {
      return saved;
    }
  } catch {
    // Storage can be blocked, full, or contain data from an older version.
  }
  return { position: 0, rate: 1 };
};

/** Saves a place on this device. Returns whether it was saved. */
export const writePlace = (key: string, place: Place) => {
  try {
    localStorage.setItem(key, JSON.stringify(place));
    return true;
  } catch {
    // Playback remains usable when storage is unavailable.
    return false;
  }
};
