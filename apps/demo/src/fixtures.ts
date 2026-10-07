import type { Narration } from "@dyslexia/narrations/client";

const ARTICLE = {
  createdAt: "2026-10-01T09:00:00Z",
  title: "How the brain learns to read",
  url: "https://www.example.org/science/reading-brain",
};

type Making = Extract<Narration, { state: "making" }>;
type Ready = Extract<Narration, { state: "ready" }>;
type Failed = Extract<Narration, { state: "failed" }>;

export const making = (overrides: Partial<Making> = {}): Making => ({
  ...ARTICLE,
  id: "making",
  stage: "reading",
  state: "making",
  ...overrides,
});

export const ready = (overrides: Partial<Ready> = {}): Ready => ({
  ...ARTICLE,
  audioUrl: "/audio/a.mp3",
  durationSeconds: 754,
  id: "ready",
  state: "ready",
  ...overrides,
});

export const failed = (overrides: Partial<Failed> = {}): Failed => ({
  ...ARTICLE,
  id: "failed",
  reason:
    "This page could not be read as an article. It may be blocked, behind a paywall, or not an article.",
  state: "failed",
  title: "Paywalled article",
  ...overrides,
});

/** A library with something in every state. */
export const library: Narration[] = [
  making({ id: "a", title: "Why we sleep" }),
  making({ id: "b", stage: "writing", title: "The case for slow reading" }),
  making({
    id: "c",
    progress: { done: 3, total: 8 },
    stage: "recording",
    title: "A field guide to clouds",
  }),
  ready({ id: "d" }),
  ready({
    durationSeconds: 1980,
    id: "e",
    title: "The quiet history of the semicolon",
    url: "https://www.newyorker.com/culture/semicolon",
  }),
  failed({ id: "f" }),
];
