import type { R2Bucket } from "@cloudflare/workers-types";
import type { WorkflowStep } from "cloudflare:workers";
import { Effect, Schema } from "effect";

import { signCapability } from "./auth.ts";
import { chunkNarration } from "./domain.ts";
import type { ProviderFailure } from "./domain.ts";
import type { PipelineEnv, PipelineParameters } from "./env.ts";
import {
  Extractor,
  makeProviderLayer,
  NarrationAdapter,
  SpeechGenerator,
} from "./providers.ts";
import {
  artifactKey,
  estimateTts,
  getJob,
  getJson,
  patchJob,
  putJson,
} from "./storage.ts";

const Source = Schema.Struct({
  markdown: Schema.String,
  sourceUrl: Schema.String,
  title: Schema.String,
});
const Draft = Schema.Struct({
  sourceUrl: Schema.String,
  text: Schema.String,
  title: Schema.String,
});
const Selection = Schema.Struct({ key: Schema.String });
const Approval = Schema.Struct({
  key: Schema.String,
  maxCostUsd: Schema.Number,
});
const Assembly = Schema.Struct({
  bytes: Schema.Number,
  durationSeconds: Schema.Number,
});
const ChunkPlan = Schema.Array(
  Schema.Struct({ index: Schema.Number, text: Schema.String })
);
const paidOptions = {
  retries: { delay: "1 second" as const, limit: 0 },
  timeout: "5 minutes" as const,
};

class ProviderOperationError extends Error {
  override name = "ProviderOperationError";
}

const runProvider = async <A>(
  program: Effect.Effect<
    A,
    ProviderFailure,
    Extractor | NarrationAdapter | SpeechGenerator
  >,
  layer: ReturnType<typeof makeProviderLayer>
): Promise<A> => {
  const outcome = await Effect.runPromise(
    program.pipe(
      Effect.provide(layer),
      Effect.match({
        onFailure: (error) => ({ message: error.message, ok: false as const }),
        onSuccess: (value) => ({ ok: true as const, value }),
      })
    )
  );
  if (!outcome.ok) {
    throw new ProviderOperationError(outcome.message);
  }
  return outcome.value;
};

// At-least-once execution is not exactly-once billing. An unfinished intent
// blocks another paid call, even when a Workflow is manually restarted.
export const paidArtifact = async (
  bucket: R2Bucket,
  jobId: string,
  name: string,
  produce: () => Promise<void>
) => {
  const output = artifactKey(jobId, name);
  if (await bucket.head(output)) {
    return output;
  }
  const intent = artifactKey(jobId, `intents/${name}.json`);
  const claimed = await bucket.put(
    intent,
    JSON.stringify({ startedAt: new Date().toISOString(), status: "pending" }),
    {
      httpMetadata: { contentType: "application/json" },
      onlyIf: { etagDoesNotMatch: "*" },
    }
  );
  if (!claimed) {
    await patchJob(bucket, jobId, {
      error:
        "A previous provider call has no saved result. Check provider billing before a manual recovery; automatic retry is blocked.",
      status: "uncertain",
    });
    throw new Error("Provider outcome is uncertain");
  }
  try {
    await produce();
    if (!(await bucket.head(output))) {
      throw new Error("Provider output was not saved");
    }
    await putJson(bucket, intent, {
      completedAt: new Date().toISOString(),
      status: "complete",
    });
    return output;
  } catch (error) {
    const reason =
      error instanceof ProviderOperationError ? `${error.message} ` : "";
    await patchJob(bucket, jobId, {
      error: `${reason}A provider request did not finish safely and may have been billed. Saved results are retained; no automatic paid retry was attempted.`,
      status: "uncertain",
    });
    throw new Error("Provider outcome is uncertain", { cause: error });
  }
};

type PinnedInput =
  | { key: string; source: typeof Source.Type }
  | { approval: typeof Approval.Type; draft: typeof Draft.Type }
  | typeof ChunkPlan.Type;

// Create once, then compare on every restart. Never replace inputs underneath
// cached paid outputs, including when two executions race to approve a job.
const pinJson = async (
  bucket: R2Bucket,
  jobId: string,
  name: string,
  value: PinnedInput,
  dependentArtifact?: string
) => {
  const key = artifactKey(jobId, name);
  if (
    dependentArtifact &&
    (await bucket.head(artifactKey(jobId, dependentArtifact))) &&
    !(await bucket.head(key))
  ) {
    throw new Error("Cached artifact has no pinned approval; start a new job");
  }
  const serialized = JSON.stringify(value);
  const claimed = await bucket.put(key, serialized, {
    httpMetadata: { contentType: "application/json" },
    onlyIf: { etagDoesNotMatch: "*" },
  });
  if (!claimed && JSON.stringify(await getJson(bucket, key)) !== serialized) {
    throw new Error("Selection or speech approval changed; start a new job");
  }
};

const selectedKey = (id: string, key: string) => {
  if (!key.startsWith(artifactKey(id, "")) || !key.endsWith(".json")) {
    throw new Error("Invalid artifact selection");
  }
  return key;
};

const assemble = async (
  env: PipelineEnv,
  params: PipelineParameters,
  chunkCount: number
) => {
  const manifestKey = artifactKey(params.jobId, "assembly.json");
  const existing = await getJson(env.AUDIO, manifestKey);
  if (
    existing !== null &&
    (await env.AUDIO.head(artifactKey(params.jobId, "recording.mp3")))
  ) {
    return Schema.decodeUnknownSync(Assembly)(existing);
  }
  // Production uses a separate signing secret; the fallback supports old fixtures.
  const signingSecret =
    env.PIPELINE_SIGNING_SECRET ?? env.PIPELINE_ACCESS_TOKEN;
  if (!signingSecret) {
    throw new Error("Assembly authorization is missing");
  }
  const token = await signCapability(signingSecret, {
    expires: Date.now() + 15 * 60 * 1000,
    jobId: params.jobId,
    scope: "assembly",
  });
  const baseUrl = params.origin
    .replace("http://localhost:", "http://host.docker.internal:")
    .replace("http://127.0.0.1:", "http://host.docker.internal:");
  const stub = env.ASSEMBLER.get(env.ASSEMBLER.idFromName("primary"));
  const response = await stub.fetch("http://assembler/assemble", {
    body: JSON.stringify({ baseUrl, chunkCount, jobId: params.jobId, token }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Assembly container did not complete");
  }
  const result = Schema.decodeUnknownSync(Assembly)(await response.json());
  const output = await env.AUDIO.head(
    artifactKey(params.jobId, "recording.mp3")
  );
  if (
    !Number.isFinite(result.durationSeconds) ||
    result.durationSeconds <= 0 ||
    !output ||
    output.size !== result.bytes
  ) {
    throw new Error("Assembled recording validation failed");
  }
  await putJson(env.AUDIO, manifestKey, result);
  return result;
};

export const runPipeline = async (
  env: PipelineEnv,
  params: PipelineParameters,
  step: WorkflowStep,
  layer = makeProviderLayer(env)
) => {
  const { jobId } = params;
  try {
    await step.do("extract article", paidOptions, async () => {
      const job = await getJob(env.AUDIO, jobId);
      if (!job) {
        throw new Error("Job not found");
      }
      const sourceKey = await paidArtifact(
        env.AUDIO,
        jobId,
        "source.json",
        async () => {
          const source = await runProvider(
            Effect.gen(function* source() {
              const extractor = yield* Extractor;
              return yield* extractor.extract(job.url);
            }),
            layer
          );
          await putJson(env.AUDIO, artifactKey(jobId, "source.json"), source);
        }
      );
      const source = Schema.decodeUnknownSync(Source)(
        await getJson(env.AUDIO, sourceKey)
      );
      await patchJob(env.AUDIO, jobId, {
        sourceKey,
        status: "source_ready",
        title: source.title,
      });
      return { sourceKey };
    });

    const sourceEvent = await step.waitForEvent("review extracted text", {
      timeout: "7 days",
      type: "source-approved",
    });
    const selection = Schema.decodeUnknownSync(Selection)(sourceEvent.payload);
    const sourceKey = selectedKey(jobId, selection.key);
    await step.do("adapt selected article", paidOptions, async () => {
      const source = Schema.decodeUnknownSync(Source)(
        await getJson(env.AUDIO, sourceKey)
      );
      await pinJson(
        env.AUDIO,
        jobId,
        "source-selection.json",
        { key: sourceKey, source },
        "draft.json"
      );
      await patchJob(env.AUDIO, jobId, {
        sourceKey,
        status: "adapting",
        title: source.title,
      });
      const draftKey = await paidArtifact(
        env.AUDIO,
        jobId,
        "draft.json",
        async () => {
          const draft = await runProvider(
            Effect.gen(function* draft() {
              const adapter = yield* NarrationAdapter;
              return yield* adapter.adapt(source);
            }),
            layer
          );
          await putJson(env.AUDIO, artifactKey(jobId, "draft.json"), draft);
        }
      );
      const draft = Schema.decodeUnknownSync(Draft)(
        await getJson(env.AUDIO, draftKey)
      );
      const chunks = chunkNarration(draft.text);
      await patchJob(env.AUDIO, jobId, {
        characters: draft.text.length,
        draftKey,
        estimatedTtsUsd: estimateTts(draft.text),
        status: "draft_ready",
        title: draft.title,
        totalChunks: chunks.length,
      });
      return { draftKey };
    });

    const draftEvent = await step.waitForEvent(
      "approve narration and speech cost",
      { timeout: "7 days", type: "draft-approved" }
    );
    const approval = Schema.decodeUnknownSync(Approval)(draftEvent.payload);
    const approvedKey = selectedKey(jobId, approval.key);
    const plan = await step.do("plan approved speech", async () => {
      const draft = Schema.decodeUnknownSync(Draft)(
        await getJson(env.AUDIO, approvedKey)
      );
      const cost = estimateTts(draft.text);
      if (
        !Number.isFinite(approval.maxCostUsd) ||
        approval.maxCostUsd <= 0 ||
        cost > approval.maxCostUsd ||
        draft.text.length > 100_000
      ) {
        throw new Error("Speech approval does not cover this narration");
      }
      const chunks = chunkNarration(draft.text);
      if (chunks.length === 0 || chunks.length > 40) {
        throw new Error("Invalid chunk plan");
      }
      await pinJson(
        env.AUDIO,
        jobId,
        "speech-approval.json",
        { approval, draft },
        "chunks/0.mp3"
      );
      await pinJson(env.AUDIO, jobId, "plan.json", chunks);
      await patchJob(env.AUDIO, jobId, {
        characters: draft.text.length,
        draftKey: approvedKey,
        estimatedTtsUsd: cost,
        status: "generating",
        title: draft.title,
        totalChunks: chunks.length,
      });
      return { count: chunks.length };
    });

    for (let offset = 0; offset < plan.count; offset += 2) {
      const indexes = Array.from(
        { length: Math.min(2, plan.count - offset) },
        (_, index) => offset + index
      );
      // eslint-disable-next-line no-await-in-loop -- Complete each two-request batch before starting more paid work; never abandon its sibling on failure.
      const results = await Promise.allSettled(
        indexes.map((index) =>
          step.do(`speech chunk ${index}`, paidOptions, async () => {
            const savedPlan = Schema.decodeUnknownSync(ChunkPlan)(
              await getJson(env.AUDIO, artifactKey(jobId, "plan.json"))
            );
            const chunk = savedPlan[index];
            if (!chunk) {
              throw new Error("Chunk is missing");
            }
            const key = await paidArtifact(
              env.AUDIO,
              jobId,
              `chunks/${index}.mp3`,
              async () => {
                const audio = await runProvider(
                  Effect.gen(function* audio() {
                    const speech = yield* SpeechGenerator;
                    return yield* speech.generate(chunk.text);
                  }),
                  layer
                );
                await env.AUDIO.put(
                  artifactKey(jobId, `chunks/${index}.mp3`),
                  audio.audio,
                  { httpMetadata: { contentType: "audio/mpeg" } }
                );
                await putJson(
                  env.AUDIO,
                  artifactKey(jobId, `receipts/${index}.json`),
                  {
                    bytes: audio.audio.byteLength,
                    requestId: audio.requestId ?? null,
                  }
                );
              }
            );
            return { key };
          })
        )
      );
      if (results.some((result) => result.status === "rejected")) {
        throw new Error("Speech generation did not finish safely");
      }
      // eslint-disable-next-line no-await-in-loop -- Save the completed batch before starting another billable batch.
      await step.do(`save progress ${offset}`, async () => {
        await patchJob(env.AUDIO, jobId, {
          completedChunks: offset + indexes.length,
        });
        return { completed: offset + indexes.length };
      });
    }

    await step.do("mark assembly", async () => {
      await patchJob(env.AUDIO, jobId, { status: "assembling" });
      return { ready: true };
    });
    const result = await step.do(
      "assemble recording",
      {
        retries: { backoff: "exponential", delay: "30 seconds", limit: 2 },
        timeout: "8 minutes",
      },
      () => assemble(env, params, plan.count)
    );
    await step.do("publish recording", async () => {
      await patchJob(env.AUDIO, jobId, {
        audioKey: artifactKey(jobId, "recording.mp3"),
        durationSeconds: result.durationSeconds,
        status: "ready",
      });
      return { ready: true };
    });
    return { durationSeconds: result.durationSeconds, jobId };
  } catch {
    const job = await getJob(env.AUDIO, jobId);
    if (job && job.status !== "uncertain") {
      await patchJob(env.AUDIO, jobId, {
        error:
          "The workflow stopped. Saved artifacts are retained. Review may have expired, or an internal step failed; no paid step was automatically retried.",
        status: "failed",
      });
    }
    throw new Error("Narration workflow stopped; inspect the saved job state");
  }
};
