import { Schema } from "effect";

import type {
  JobDetail,
  PipelineJob,
  PipelineSession,
} from "../pipeline/contracts";
import {
  CreatedJobSchema,
  JobDetailSchema,
  JobListSchema,
  SessionSchema,
} from "../pipeline/contracts";

const API = "/api/pipeline";

/** A failed pipeline request, with the server's explanation when it gave one. */
export class PipelineError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PipelineError";
    this.status = status;
  }
}

const isErrorBody = (value: unknown): value is { error: string } =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  typeof value.error === "string";

const request = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${API}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new PipelineError(
      isErrorBody(body)
        ? body.error
        : "The narration service could not complete this request.",
      response.status
    );
  }
  if (response.status === 204) {
    return null;
  }
  const body: unknown = await response.json();
  return body;
};

export const fetchSession = async (
  signal?: AbortSignal
): Promise<PipelineSession> =>
  Schema.decodeUnknownSync(SessionSchema)(
    await request("/session", { signal })
  );

export const fetchJobs = async (
  signal?: AbortSignal
): Promise<readonly PipelineJob[]> =>
  Schema.decodeUnknownSync(JobListSchema)(await request("/jobs", { signal }))
    .jobs;

export const fetchJob = async (
  id: string,
  signal?: AbortSignal
): Promise<JobDetail> =>
  Schema.decodeUnknownSync(JobDetailSchema)(
    await request(`/jobs/${encodeURIComponent(id)}`, { signal })
  );

export const createJob = async (url: string): Promise<PipelineJob> =>
  Schema.decodeUnknownSync(CreatedJobSchema)(
    await request("/jobs", { body: JSON.stringify({ url }), method: "POST" })
  ).job;

export interface SourceSubmission {
  readonly markdown: string;
  readonly title: string;
}

export const submitSource = async (id: string, body: SourceSubmission) => {
  await request(`/jobs/${encodeURIComponent(id)}/source`, {
    body: JSON.stringify(body),
    method: "POST",
  });
};

export interface ApprovalSubmission {
  readonly maxCostUsd: number;
  readonly text: string;
  readonly title: string;
}

export const approveDraft = async (id: string, body: ApprovalSubmission) => {
  await request(`/jobs/${encodeURIComponent(id)}/approve`, {
    body: JSON.stringify(body),
    method: "POST",
  });
};

export const audioUrl = (id: string) =>
  `${API}/jobs/${encodeURIComponent(id)}/audio`;
