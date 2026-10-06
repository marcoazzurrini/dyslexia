import type { R2Bucket } from "@cloudflare/workers-types";
import { Effect, Schema } from "effect";

import type { PipelineJob } from "./contracts.ts";
import { PipelineJobSchema as Job } from "./contracts.ts";

export const jobKey = (id: string) => `pipeline/jobs/${id}.json`;
export const artifactKey = (id: string, name: string) =>
  `pipeline/artifacts/${id}/${name}`;
export const isJobId = (value: string) =>
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u.test(
    value
  );
export const estimateTts = (text: string) =>
  Math.ceil((text.length * 0.08 * 1000) / 1000) / 1000;

export const putJson = <T>(bucket: R2Bucket, name: string, value: T) =>
  bucket.put(name, JSON.stringify(value), {
    httpMetadata: { contentType: "application/json" },
  });

export const getJson = async (
  bucket: R2Bucket,
  name: string
): Promise<typeof Schema.Json.Type> => {
  const object = await bucket.get(name);
  return object
    ? Schema.decodeUnknownSync(Schema.Json)(await object.json())
    : null;
};

export const getJob = async (
  bucket: R2Bucket,
  id: string
): Promise<PipelineJob | null> => {
  const value = await getJson(bucket, jobKey(id));
  return value === null ? null : Schema.decodeUnknownSync(Job)(value);
};

export const patchJob = async (
  bucket: R2Bucket,
  id: string,
  patch: Partial<PipelineJob>
) => {
  const previous = await getJob(bucket, id);
  if (!previous) {
    throw new Error("Job not found");
  }
  const next = Schema.decodeUnknownSync(Job)({
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await putJson(bucket, jobKey(id), next);
  return next;
};

export const listJobs = async (bucket: R2Bucket) => {
  const index = await bucket.list({ limit: 50, prefix: "pipeline/index/" });
  const jobs = await Effect.runPromise(
    Effect.forEach(
      index.objects,
      (object) => {
        const id = object.key.split("/").at(-1);
        return id && isJobId(id)
          ? Effect.tryPromise(() => getJob(bucket, id))
          : Effect.succeed(null);
      },
      { concurrency: 4 }
    )
  );
  return jobs.filter((job): job is PipelineJob => job !== null);
};

export const initializeJob = async (bucket: R2Bucket, url: string) => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job: PipelineJob = {
    characters: 0,
    completedChunks: 0,
    createdAt: now,
    estimatedTtsUsd: 0,
    id,
    status: "extracting",
    title: new URL(url).hostname,
    totalChunks: 0,
    updatedAt: now,
    url,
  };
  await putJson(bucket, jobKey(id), job);
  const order = String(9_999_999_999_999 - Date.now()).padStart(13, "0");
  await bucket.put(`pipeline/index/${order}/${id}`, "");
  return job;
};

export const readBoundedJson = async (
  request: Request,
  limit = 450_000
): Promise<typeof Schema.Json.Type> => {
  const reader = request.body?.getReader();
  if (!reader) {
    throw new Error("A JSON body is required");
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      // eslint-disable-next-line no-await-in-loop -- Stream reads must remain sequential and enforce the byte limit before accepting more data.
      const item = await reader.read();
      if (item.done) {
        break;
      }
      length += item.value.byteLength;
      if (length > limit) {
        throw new Error("Request body is too large");
      }
      chunks.push(item.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {
      // Preserve the original parsing or size error if cancellation also fails.
    });
    throw error;
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return Schema.decodeUnknownSync(Schema.Json)(
    JSON.parse(new TextDecoder().decode(body))
  );
};
