import type { WorkflowStep, WorkflowStepConfig } from "cloudflare:workers";
import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import type { Tracer } from "effect";

import type { NarrationsEnv } from "./config.ts";
import { INTERRUPTED } from "./errors.ts";
import type { MakingError } from "./errors.ts";
import { servicesFor, storageFor } from "./layers.ts";
import { PARTS_AT_ONCE } from "./limits.ts";
import {
  publish,
  readArticle,
  recordPart,
  reportProgress,
  settle,
  stop,
  writeScript,
} from "./making.ts";
import type { Outcome } from "./making.ts";
import { ArticleSchema } from "./services/reader.ts";
import type { Reader } from "./services/reader.ts";
import type { Store } from "./services/store.ts";
import type { Voice } from "./services/voice.ts";
import type { Writer } from "./services/writer.ts";
import { flushTraces, tracingFor } from "./telemetry.ts";

type Services = Reader | Writer | Voice | Store;

/** Everything a run needs, from the Worker's environment. */
export const runtimeFor = (env: NarrationsEnv) =>
  ManagedRuntime.make(
    Layer.mergeAll(servicesFor(env), storageFor(env), tracingFor(env))
  );

// Expected failures come back as results. Cloudflare retries a step only
// when it throws: a crash, an eviction, or a bug.
const STEP: WorkflowStepConfig = {
  retries: { backoff: "exponential", delay: "30 seconds", limit: 2 },
  timeout: "1 hour",
};

// Cloudflare saves each step's result. A value is saved as JSON text and
// checked against its schema when read back, as after a restart.
type Saved = { readonly json: string } | { readonly reason: string };

class StoppedError extends Error {
  override name = "StoppedError";
}

const makeSteps = async (
  id: string,
  step: WorkflowStep,
  runtime: ManagedRuntime.ManagedRuntime<Services, unknown>,
  parent: Tracer.AnySpan
) => {
  // Each step's spans are sent when it ends, in case the run stops there.
  const traced = <A, E>(name: string, effect: Effect.Effect<A, E, Services>) =>
    runtime.runPromise(
      effect.pipe(
        Effect.withSpan(name, { attributes: { "narration.id": id }, parent }),
        Effect.ensuring(flushTraces)
      )
    );

  const run = async <A, I>(
    name: string,
    schema: Schema.Codec<A, I>,
    program: Effect.Effect<A, MakingError, Services>
  ): Promise<A> => {
    const json = Schema.fromJsonString(schema);
    const save = (outcome: Outcome<A>): Effect.Effect<Saved> =>
      outcome.ok
        ? Schema.encodeEffect(json)(outcome.value).pipe(
            Effect.map((text) => ({ json: text })),
            Effect.orDie
          )
        : Effect.succeed({ reason: outcome.reason });
    const saved = await step.do(name, STEP, () =>
      traced(
        name,
        settle(program).pipe(
          Effect.tap((outcome) =>
            outcome.ok
              ? Effect.void
              : Effect.annotateCurrentSpan("narration.reason", outcome.reason)
          ),
          Effect.flatMap(save)
        )
      )
    );
    if ("reason" in saved) {
      throw new StoppedError(saved.reason);
    }
    return Schema.decodeUnknownSync(json)(saved.json);
  };

  try {
    const article = await run(
      "read the article",
      ArticleSchema,
      readArticle(id)
    );
    const parts = await run(
      "write the script",
      Schema.Array(Schema.String),
      writeScript(id, article)
    );
    for (let start = 0; start < parts.length; start += PARTS_AT_ONCE) {
      const batch = parts.slice(start, start + PARTS_AT_ONCE);
      // Let every part in the batch finish, so none is saved after cleanup.
      // eslint-disable-next-line no-await-in-loop -- Record a few parts at a time.
      const results = await Promise.allSettled(
        batch.map((text, offset) =>
          run(
            `record part ${start + offset + 1}`,
            Schema.Number,
            recordPart(id, start + offset, text)
          )
        )
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) {
        throw failure.reason;
      }
      const done = start + batch.length;
      // eslint-disable-next-line no-await-in-loop -- Save progress after each batch.
      await run(
        `save progress ${done}`,
        Schema.Number,
        reportProgress(id, done, parts.length)
      );
    }
    await run(
      "publish the recording",
      Schema.Number,
      publish(id, parts.length)
    );
  } catch (error) {
    const reason = error instanceof StoppedError ? error.message : INTERRUPTED;
    await step.do("clean up", STEP, async () => {
      await traced("clean up", stop(id, reason));
      return reason;
    });
    // Mark the run failed in Cloudflare's dashboard too.
    throw error;
  }
};

/**
 * Makes a narration: read the article, write the script, record its parts,
 * and join them. If any step fails, deletes what was made and saves the
 * reason. Cloudflare saves each step's result, so a run that restarts skips
 * the steps it finished.
 */
export const makeNarration = (
  id: string,
  step: WorkflowStep,
  runtime: ManagedRuntime.ManagedRuntime<Services, unknown>
): Promise<void> =>
  // One trace per run, so a run's steps can be read as one story.
  runtime.runPromise(
    Effect.currentSpan.pipe(
      Effect.flatMap((span) =>
        Effect.tryPromise({
          catch: (error) => error,
          try: () => makeSteps(id, step, runtime, span),
        })
      ),
      Effect.withSpan("make narration", {
        attributes: { "narration.id": id },
        root: true,
      }),
      Effect.ensuring(flushTraces)
    )
  );
