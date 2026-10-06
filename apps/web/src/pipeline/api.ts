import { Effect, Schema } from "effect";

import { serveAudioObject } from "../server/audio-response.ts";
import {
  authenticated,
  configuredSecret,
  matchesSecret,
  sameOrigin,
  sessionCookie,
  signCapability,
} from "./auth.ts";
import {
  chunkNarration,
  InvalidInput,
  NarrationDraftSchema,
  SourceDocumentSchema,
  validateSourceUrl,
} from "./domain.ts";
import type { PipelineEnv } from "./env.ts";
import {
  artifactKey,
  estimateTts,
  getJob,
  getJson,
  initializeJob,
  isJobId,
  listJobs,
  patchJob,
  putJson,
  readBoundedJson,
} from "./storage.ts";

const Login = Schema.Struct({ token: Schema.String });
const Submission = Schema.Struct({ url: Schema.String });
const SourceSelection = Schema.Struct({
  markdown: Schema.String,
  title: Schema.String,
});
const Approval = Schema.Struct({
  maxCostUsd: Schema.Number,
  text: Schema.String,
  title: Schema.String,
});
const json = <T>(body: T, status = 200, extra?: HeadersInit) =>
  Response.json(body, {
    headers: { "Cache-Control": "no-store", ...extra },
    status,
  });
const failure = (error: string, status: number) => json({ error }, status);
const configured = (env: PipelineEnv) =>
  Boolean(env.PIPELINE_ACCESS_TOKEN?.length) &&
  configuredSecret(env.PIPELINE_SIGNING_SECRET ?? env.PIPELINE_ACCESS_TOKEN) &&
  Boolean(
    env.FIRECRAWL_API_KEY &&
    env.OPENROUTER_API_KEY &&
    env.ELEVENLABS_API_KEY &&
    env.NARRATION
  );
const validTitle = (title: string) =>
  title.trim().length > 0 && title.length <= 300;
const approveSource = async (
  request: Request,
  env: PipelineEnv,
  id: string
) => {
  const job = await getJob(env.AUDIO, id);
  if (!job || job.status !== "source_ready") {
    return failure("Source is not ready for selection", 409);
  }
  const selected = Schema.decodeUnknownSync(SourceSelection)(
    await readBoundedJson(request)
  );
  if (
    !validTitle(selected.title) ||
    !selected.markdown.trim() ||
    selected.markdown.length > 80_000
  ) {
    return failure(
      "Choose a title and between 1 and 80,000 source characters",
      400
    );
  }
  const key = artifactKey(id, `selection-${crypto.randomUUID()}.json`);
  const document = Schema.decodeUnknownSync(SourceDocumentSchema)({
    markdown: selected.markdown,
    sourceUrl: job.url,
    title: selected.title.trim(),
  });
  await putJson(env.AUDIO, key, document);
  const instance = await env.NARRATION.get(id);
  await instance.sendEvent({ payload: { key }, type: "source-approved" });
  return json({ ok: true }, 202);
};

const approveDraft = async (request: Request, env: PipelineEnv, id: string) => {
  const job = await getJob(env.AUDIO, id);
  if (!job || job.status !== "draft_ready") {
    return failure("Narration is not ready for approval", 409);
  }
  const approved = Schema.decodeUnknownSync(Approval)(
    await readBoundedJson(request)
  );
  if (
    !validTitle(approved.title) ||
    !approved.text.trim() ||
    approved.text.length > 100_000
  ) {
    return failure(
      "Choose a title and between 1 and 100,000 narration characters",
      400
    );
  }
  if (
    !Number.isFinite(approved.maxCostUsd) ||
    approved.maxCostUsd <= 0 ||
    approved.maxCostUsd > 50 ||
    estimateTts(approved.text) > approved.maxCostUsd
  ) {
    return failure("The estimated speech cost exceeds the approved limit", 400);
  }
  const chunks = chunkNarration(approved.text);
  if (chunks.length > 40) {
    return failure("Narration exceeds the 40-chunk limit", 400);
  }
  const key = artifactKey(id, `approved-${crypto.randomUUID()}.json`);
  const draft = Schema.decodeUnknownSync(NarrationDraftSchema)({
    sourceUrl: job.url,
    text: approved.text,
    title: approved.title.trim(),
  });
  await putJson(env.AUDIO, key, draft);
  const instance = await env.NARRATION.get(id);
  await instance.sendEvent({
    payload: { key, maxCostUsd: approved.maxCostUsd },
    type: "draft-approved",
  });
  return json({ ok: true }, 202);
};

const session = async (request: Request, env: PipelineEnv) => {
  const secret = env.PIPELINE_SIGNING_SECRET ?? env.PIPELINE_ACCESS_TOKEN;
  if (request.method === "GET") {
    return json({
      authenticated:
        configuredSecret(secret) && (await authenticated(request, secret)),
      configured: configured(env),
    });
  }
  if (!sameOrigin(request)) {
    return failure("Cross-origin request rejected", 403);
  }
  if (request.method === "DELETE") {
    return json({ authenticated: false }, 200, {
      "Set-Cookie": sessionCookie(request, "", 0),
    });
  }
  if (request.method !== "POST") {
    return failure("Method not allowed", 405);
  }
  if (!configuredSecret(secret) || !configured(env)) {
    return failure("Pipeline secrets or bindings are not configured", 503);
  }
  const { token } = Schema.decodeUnknownSync(Login)(
    await readBoundedJson(request, 4096)
  );
  const allowed = await env.PIPELINE_LOGIN_LIMIT?.limit({
    key: "pipeline-login",
  });
  if (allowed && !allowed.success) {
    return failure("Too many sign-in attempts. Wait one minute.", 429);
  }
  if (
    token.length > 512 ||
    !(await matchesSecret(token, env.PIPELINE_ACCESS_TOKEN ?? ""))
  ) {
    return failure("Invalid access token", 401);
  }
  const seconds = 7 * 24 * 60 * 60;
  const cookie = await signCapability(secret, {
    expires: Date.now() + seconds * 1000,
    scope: "session",
  });
  return json({ authenticated: true }, 200, {
    "Set-Cookie": sessionCookie(request, cookie, seconds),
  });
};

const collection = async (request: Request, env: PipelineEnv) => {
  if (request.method === "GET") {
    return json({ jobs: await listJobs(env.AUDIO) });
  }
  if (request.method !== "POST") {
    return failure("Method not allowed", 405);
  }
  const { url } = Schema.decodeUnknownSync(Submission)(
    await readBoundedJson(request, 4096)
  );
  let normalized: string;
  try {
    normalized = await Effect.runPromise(validateSourceUrl(url));
  } catch {
    return failure("Use a public HTTPS article URL without credentials", 400);
  }
  const jobs = await listJobs(env.AUDIO);
  const active = jobs.filter(
    (job) => !["ready", "failed", "uncertain"].includes(job.status)
  );
  if (active.length >= 5) {
    return failure(
      "Finish an existing job before creating another (limit: 5)",
      429
    );
  }
  const job = await initializeJob(env.AUDIO, normalized);
  try {
    await env.NARRATION.create({
      id: job.id,
      params: { jobId: job.id },
    });
  } catch {
    await patchJob(env.AUDIO, job.id, {
      error:
        "Workflow startup could not be confirmed. It may still run; refresh this job before creating another.",
      status: "uncertain",
    });
    return failure(
      "Workflow startup is unconfirmed; inspect the existing job before resubmitting",
      503
    );
  }
  return json({ job }, 202);
};

const readJob = async (
  request: Request,
  env: PipelineEnv,
  id: string,
  action?: string
) => {
  const job = await getJob(env.AUDIO, id);
  if (!job) {
    return failure("Not found", 404);
  }
  if (action === "audio" && job.status === "ready" && job.audioKey) {
    return serveAudioObject(request, job.audioKey, env.AUDIO);
  }
  if (action === undefined && request.method === "GET") {
    return json({
      draft:
        job.status === "draft_ready" && job.draftKey
          ? await getJson(env.AUDIO, job.draftKey)
          : undefined,
      job,
      source:
        job.status === "source_ready" && job.sourceKey
          ? await getJson(env.AUDIO, job.sourceKey)
          : undefined,
    });
  }
  return failure("Not found", 404);
};

const dispatch = async (request: Request, env: PipelineEnv) => {
  const parts = new URL(request.url).pathname
    .slice("/api/pipeline/".length)
    .split("/");
  if (parts[0] === "session") {
    return session(request, env);
  }
  const secret = env.PIPELINE_SIGNING_SECRET ?? env.PIPELINE_ACCESS_TOKEN;
  if (!configuredSecret(secret) || !configured(env)) {
    return failure("Pipeline secrets or bindings are not configured", 503);
  }
  if (!(await authenticated(request, secret))) {
    return failure("Sign in to create or view narrations", 401);
  }
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request)) {
    return failure("Cross-origin request rejected", 403);
  }
  if (parts[0] !== "jobs") {
    return failure("Not found", 404);
  }
  const [, id] = parts;
  if (!id) {
    return collection(request, env);
  }
  if (!isJobId(id)) {
    return failure("Not found", 404);
  }
  if (parts[2] === "source" && request.method === "POST") {
    return approveSource(request, env, id);
  }
  if (parts[2] === "approve" && request.method === "POST") {
    return approveDraft(request, env, id);
  }
  if (parts.length > 3) {
    return failure("Not found", 404);
  }
  return readJob(request, env, id, parts[2]);
};

export const pipelineApi = async (
  request: Request,
  env: PipelineEnv
): Promise<Response> => {
  try {
    return await dispatch(request, env);
  } catch (error) {
    if (
      Schema.isSchemaError(error) ||
      error instanceof SyntaxError ||
      error instanceof InvalidInput
    ) {
      return failure("Invalid request data", 400);
    }
    if (
      error instanceof Error &&
      ["A JSON body is required", "Request body is too large"].includes(
        error.message
      )
    ) {
      return failure(error.message, 400);
    }
    return failure(
      "The operation could not be completed. Refresh the job before trying again.",
      503
    );
  }
};
