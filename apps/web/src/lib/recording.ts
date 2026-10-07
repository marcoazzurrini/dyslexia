import type { Narration } from "@dyslexia/narrations/client";

/** A finished narration, ready to play. */
export interface Recording {
  readonly audioUrl: string;
  readonly durationSeconds: number;
  readonly id: string;
  readonly sourceUrl: string;
  readonly title: string;
  /** Changes when the audio changes; saved positions are keyed by it. */
  readonly version: string;
}

export const recordingOf = (
  narration: Extract<Narration, { state: "ready" }>
): Recording => ({
  audioUrl: narration.audioUrl,
  durationSeconds: narration.durationSeconds,
  id: narration.id,
  sourceUrl: narration.url,
  title: narration.title,
  // A narration's audio never changes; making it again gives a new id.
  version: narration.id,
});

/** The site name of a link, such as "overreacted.io". */
export const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return url;
  }
};

/** A duration such as "12 min" or "1 h 5 min". */
export const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
};
