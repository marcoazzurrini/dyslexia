import type {
  JobDetail,
  JobStatus,
  PipelineJob,
} from "@dyslexia/web/contracts";

const ARTICLE = `# How the brain learns to read

Reading is a recent invention. Writing appeared about five thousand years
ago, far too recently for evolution to give us a brain region for it.

Instead, learning to read recycles a part of the visual system that
recognizes faces and objects.

Share this article · Subscribe to our newsletter`;

const NARRATION = `Reading is a recent invention. Writing appeared about five thousand years ago. That is far too recently for evolution to give us a part of the brain just for reading.

Instead, when we learn to read, we reuse part of the visual system. That part normally recognizes faces and objects.`;

/** A narration in the given state, with realistic content. */
export const job = (
  status: JobStatus,
  overrides: Partial<PipelineJob> = {}
): PipelineJob => ({
  characters: NARRATION.length,
  completedChunks: 0,
  createdAt: "2026-10-01T09:00:00Z",
  durationSeconds: 754,
  estimatedTtsUsd: 0.38,
  id: `job-${status}`,
  status,
  title: "How the brain learns to read",
  totalChunks: 6,
  updatedAt: "2026-10-01T09:05:00Z",
  url: "https://www.example.org/science/reading-brain",
  ...overrides,
});

export const detail = (
  status: JobStatus,
  overrides: Partial<PipelineJob> = {}
): JobDetail => ({
  draft: {
    sourceUrl: "https://www.example.org/science/reading-brain",
    text: NARRATION,
    title: "How the brain learns to read",
  },
  job: job(status, overrides),
  source: {
    markdown: ARTICLE,
    sourceUrl: "https://www.example.org/science/reading-brain",
    title: "How the brain learns to read",
  },
});

/** A library with something in every state. */
export const library: PipelineJob[] = [
  job("draft_ready", { id: "a", title: "Why we sleep" }),
  job("source_ready", { id: "b", title: "The case for slow reading" }),
  job("generating", {
    completedChunks: 3,
    id: "c",
    title: "A field guide to clouds",
  }),
  job("ready", { id: "d" }),
  job("ready", {
    durationSeconds: 1980,
    id: "e",
    title: "The quiet history of the semicolon",
    url: "https://www.newyorker.com/culture/semicolon",
  }),
  job("failed", {
    error: "The article page could not be read (HTTP 403).",
    id: "f",
    title: "Paywalled article",
  }),
];
