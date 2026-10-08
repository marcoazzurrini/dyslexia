import type { Workflow } from "@cloudflare/workers-types";
import type { WorkflowStep } from "cloudflare:workers";
import { Effect, Layer, ManagedRuntime, Schedule, Tracer } from "effect";

import type {
  ArticleUnreadable,
  ScriptIncomplete,
  ServiceRejected,
  ServiceUnavailable,
} from "../../src/errors.ts";
import { RetrySchedule } from "../../src/making.ts";
import type { NarrationParams } from "../../src/services/engine.ts";
import { Reader } from "../../src/services/reader.ts";
import type { Article } from "../../src/services/reader.ts";
import { Store } from "../../src/services/store.ts";
import { Voice } from "../../src/services/voice.ts";
import { Writer } from "../../src/services/writer.ts";
import { speech } from "./audio.ts";

export const ARTICLE: Article = {
  text: "Reading is a recent invention.\n\nLearning to read recycles part of the visual system.",
  title: "How the brain learns to read",
};

type ServiceError = ServiceUnavailable | ServiceRejected;

export interface Script {
  readonly read?: (
    url: string
  ) => Effect.Effect<Article, ArticleUnreadable | ServiceError>;
  readonly write?: (
    article: Article
  ) => Effect.Effect<string, ScriptIncomplete | ServiceError>;
  readonly speak?: (text: string) => Effect.Effect<Uint8Array, ServiceError>;
}

/**
 * Stand-ins for the outside services. By default they read `ARTICLE`, write
 * it back word for word, and speak two frames of audio per part. `calls`
 * counts what was asked of them.
 */
export const fakeServices = (script: Script = {}) => {
  const read: string[] = [];
  const speak: string[] = [];
  const calls = { read, speak, write: 0 };
  const layer = Layer.mergeAll(
    Layer.succeed(Reader, {
      read: (url) =>
        Effect.suspend(() => {
          calls.read.push(url);
          return script.read?.(url) ?? Effect.succeed(ARTICLE);
        }),
    }),
    Layer.succeed(Writer, {
      write: (article) =>
        Effect.suspend(() => {
          calls.write += 1;
          return script.write?.(article) ?? Effect.succeed(article.text);
        }),
    }),
    Layer.succeed(Voice, {
      speak: (text) =>
        Effect.suspend(() => {
          calls.speak.push(text);
          return script.speak?.(text) ?? Effect.succeed(speech());
        }),
    })
  );
  return { calls, layer };
};

/** Retries without waiting, so tests run instantly. */
export const instantRetries = Layer.succeed(RetrySchedule, Schedule.spaced(0));

/** A tracer that keeps every span it starts, to inspect after a run. */
export const recordingTracer = () => {
  const spans: Tracer.NativeSpan[] = [];
  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      spans.push(span);
      return span;
    },
  });
  return {
    /** The spans with this name, in the order they started. */
    named: (name: string) => spans.filter((span) => span.name === name),
    spans,
    tracer,
  };
};

/** A runtime with the given services, a bucket, and instant retries. */
export const runtimeWith = (
  services: ReturnType<typeof fakeServices>,
  bucket: Parameters<typeof Store.layer>[0],
  tracer: Tracer.Tracer = Tracer.make({
    span: (options) => new Tracer.NativeSpan(options),
  })
) =>
  ManagedRuntime.make(
    Layer.mergeAll(
      services.layer,
      Store.layer(bucket),
      instantRetries,
      Layer.succeed(Tracer.Tracer)(tracer)
    )
  );

interface StepCall {
  readonly name: string;
  readonly attempts: number;
}

/**
 * Cloudflare's durable step runner, in memory. A step that finished returns
 * its saved result without running again, as after a restart; a step that
 * throws is tried again up to its retry limit.
 */
export const fakeSteps = (
  options: {
    /** Saved results, as from an earlier run. */
    readonly saved?: Map<string, unknown>;
    /** The step at which the Worker is evicted: it never finishes. */
    readonly evictAt?: string;
  } = {}
) => {
  const saved = options.saved ?? new Map<string, unknown>();
  const calls: StepCall[] = [];
  const step = {
    do: async <T>(
      name: string,
      config: { retries?: { limit: number } },
      run: () => Promise<T>
    ): Promise<T> => {
      if (saved.has(name)) {
        // SAFETY: a step's name always stands for the same work, so the
        // result saved under it has the type that work returns.
        return saved.get(name) as T;
      }
      if (name === options.evictAt) {
        // An evicted Worker never continues.
        return Promise.withResolvers<T>().promise;
      }
      const limit = config.retries?.limit ?? 0;
      let failure: unknown;
      for (let attempt = 1; attempt <= limit + 1; attempt += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop -- Attempts run one after another.
          const value = await run();
          calls.push({ attempts: attempt, name });
          // Cloudflare stores results as structured clones.
          saved.set(name, structuredClone(value));
          return value;
        } catch (error) {
          failure = error;
        }
      }
      calls.push({ attempts: limit + 1, name });
      throw failure;
    },
  };
  return {
    calls,
    /** Names of the steps that ran, in order. */
    names: () => calls.map((call) => call.name),
    saved,
    // SAFETY: `do` with a config is the only WorkflowStep method narrations
    // call; tests fail on any other use.
    // eslint-disable-next-line anti-slop/no-chained-type-assertions -- A partial stand-in for a platform class.
    step: step as unknown as WorkflowStep,
  };
};

/**
 * Cloudflare's Workflow binding, in memory. Runs are "running" once created;
 * tests change `statuses` to simulate a run that stopped.
 */
export const fakeWorkflow = (options: { failCreate?: boolean } = {}) => {
  const statuses = new Map<string, string>();
  const binding = {
    create: ({ id }: { id: string; params: NarrationParams }) => {
      if (options.failCreate) {
        return Promise.reject(new Error("Workflow unavailable"));
      }
      statuses.set(id, "running");
      return Promise.resolve({ id });
    },
    get: (id: string) => {
      const status = statuses.get(id);
      return status
        ? Promise.resolve({ status: () => Promise.resolve({ status }) })
        : Promise.reject(new Error("instance.not_found"));
    },
  };
  return {
    // SAFETY: implements the two calls narrations make, `create` and
    // `get(...).status()`.
    // eslint-disable-next-line anti-slop/no-chained-type-assertions -- A partial stand-in for a platform binding.
    binding: binding as unknown as Workflow<NarrationParams>,
    statuses,
  };
};
