import type { Narration } from "@dyslexia/narrations/client";
import type { Listening } from "@dyslexia/web/lib/listening";

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

/** A library with narrations at every point of listening. */
export const listened: Narration[] = [
  making({ id: "a", title: "Why we sleep" }),
  ready({ id: "d" }),
  ready({
    durationSeconds: 1980,
    id: "e",
    title: "The quiet history of the semicolon",
    url: "https://www.newyorker.com/culture/semicolon",
  }),
  ready({
    durationSeconds: 1500,
    id: "g",
    title: "Programming as theory building",
    url: "https://pages.cs.wisc.edu/~remzi/Naur.pdf",
  }),
  ready({
    durationSeconds: 640,
    id: "h",
    title: "Before you memo()",
    url: "https://overreacted.io/before-you-memo/",
  }),
  ready({ id: "i", title: "A field guide to clouds" }),
  failed({ id: "f" }),
];

/** A regular listener's library, long enough to scroll. */
export const bookshelf: Narration[] = [
  making({
    id: "m1",
    progress: { done: 5, total: 9 },
    stage: "recording",
    title: "The unreasonable effectiveness of checklists",
    url: "https://www.newyorker.com/magazine/checklist",
  }),
  making({
    id: "m2",
    stage: "writing",
    title: "Why we sleep",
    url: "https://aeon.co/essays/why-we-sleep",
  }),
  ready({
    durationSeconds: 1140,
    id: "r1",
    title: "What dyslexia is, and what it is not",
    url: "https://www.bbc.co.uk/future/dyslexia",
  }),
  ready({
    durationSeconds: 2460,
    id: "r2",
    title: "The tyranny of the inbox",
    url: "https://aeon.co/essays/the-tyranny-of-the-inbox",
  }),
  ready({
    durationSeconds: 1980,
    id: "e",
    title: "The quiet history of the semicolon",
    url: "https://www.newyorker.com/culture/semicolon",
  }),
  ready({
    durationSeconds: 1500,
    id: "g",
    title: "Programming as theory building",
    url: "https://pages.cs.wisc.edu/~remzi/Naur.pdf",
  }),
  ready({ id: "d" }),
  ready({
    durationSeconds: 980,
    id: "r3",
    title:
      "Notes on structured concurrency, or: go statement considered harmful",
    url: "https://vorpus.org/blog/notes-on-structured-concurrency",
  }),
  ready({
    durationSeconds: 1320,
    id: "r4",
    title: "The joy of a long walk",
    url: "https://www.theatlantic.com/health/long-walk",
  }),
  ready({
    durationSeconds: 640,
    id: "h",
    title: "Before you memo()",
    url: "https://overreacted.io/before-you-memo/",
  }),
  ready({
    durationSeconds: 860,
    id: "r5",
    title: "How to read a paper",
    url: "https://web.stanford.edu/class/ee384m/how-to-read.pdf",
  }),
  ready({
    durationSeconds: 1720,
    id: "r6",
    title: "A field guide to clouds",
    url: "https://www.example.org/nature/clouds",
  }),
  failed({ id: "f" }),
];

const POSITIONS = new Map([
  ["e", { playedAt: 2, position: 1200 }],
  ["g", { playedAt: 3, position: 400 }],
  ["h", { playedAt: 1, position: 640 }],
  ["r1", { playedAt: 5, position: 300 }],
  ["r2", { playedAt: 4, position: 900 }],
  ["r5", { playedAt: 0, position: 860 }],
]);

/** How far a story's listener got: see `POSITIONS`; others not started. */
export const listeningOf = (
  narration: Extract<Narration, { state: "ready" }>
): Listening => {
  const { playedAt, position } = POSITIONS.get(narration.id) ?? {
    playedAt: 0,
    position: 0,
  };
  const remaining = Math.max(0, narration.durationSeconds - position);
  let status: Listening["status"] = "in-progress";
  if (position === 0) {
    status = "not-started";
  } else if (remaining === 0) {
    status = "finished";
  }
  return { playedAt, position, remaining, status };
};
