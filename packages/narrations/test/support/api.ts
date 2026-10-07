import { Effect, Schema } from "effect";

import type { NarrationsEnv } from "../../src/config.ts";
import { NarrationRecordSchema, NarrationSchema } from "../../src/narration.ts";
import type { Narration, NarrationRecord } from "../../src/narration.ts";
import { handleNarrations } from "../../src/server.ts";
import { Store } from "../../src/services/store.ts";
import { speech } from "./audio.ts";
import { memoryBucket } from "./bucket.ts";
import { fakeWorkflow } from "./fakes.ts";

export const ORIGIN = "https://app.test";

export const KEYS = {
  ELEVENLABS_API_KEY: "eleven-secret",
  FIRECRAWL_API_KEY: "firecrawl-secret",
  OPENROUTER_API_KEY: "openrouter-secret",
};

/**
 * The narrations API on an in-memory bucket and workflow, for someone signed
 * in unless `access.signedIn` is set to false.
 */
export const apiSetup = (
  options: { failCreate?: boolean; keys?: Partial<typeof KEYS> } = {}
) => {
  const memory = memoryBucket();
  const workflow = fakeWorkflow(options);
  const env: NarrationsEnv = {
    AUDIO: memory.bucket,
    NARRATION: workflow.binding,
    ...KEYS,
    ...options.keys,
  };
  const access = { signedIn: true };
  const handle = (request: Request) =>
    handleNarrations(request, env, {
      isSignedIn: () => Promise.resolve(access.signedIn),
    });
  const call = (
    method: string,
    path = "",
    init: { body?: unknown; headers?: Record<string, string> } = {}
  ) =>
    handle(
      new Request(`${ORIGIN}/api/narrations${path}`, {
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        headers: {
          "Content-Type": "application/json",
          Origin: ORIGIN,
          ...init.headers,
        },
        method,
      })
    );
  /** The status of a request's response. */
  const status = async (...args: Parameters<typeof call>) => {
    const response = await call(...args);
    return response.status;
  };
  /** The narrations the API lists. */
  const listed = async (): Promise<Narration[]> => {
    const response = await call("GET");
    return Schema.decodeUnknownSync(
      Schema.mutable(Schema.Array(NarrationSchema))
    )(await response.json());
  };
  const store = <A, E>(effect: Effect.Effect<A, E, Store>) =>
    Effect.runPromise(effect.pipe(Effect.provide(Store.layer(memory.bucket))));
  let seeded = 0;
  /**
   * Saves a narration as if it had been made earlier. Each one counts as
   * newer than the last, so it lists first.
   */
  const seed = async (
    record: Partial<NarrationRecord> & Pick<NarrationRecord, "state">,
    { running = false }: { running?: boolean } = {}
  ) => {
    seeded += 1;
    // Each test gives the fields its state needs; decoding drops the rest.
    const full = Schema.decodeUnknownSync(NarrationRecordSchema)({
      createdAt: new Date().toISOString(),
      id: `${String(8_000_000_000_000 - seeded)}-${seeded.toString(16).padStart(8, "0")}`,
      stage: "reading",
      title: "Seeded",
      url: "https://example.org/seeded",
      ...record,
    });
    await store(
      Effect.gen(function* body() {
        const s = yield* Store;
        yield* s.save(full);
        if (full.state === "ready") {
          yield* s.savePart(full.id, 0, speech(4));
          yield* s.joinParts(full.id, 1);
        } else {
          yield* s.savePart(full.id, 0, speech());
        }
      })
    );
    if (running) {
      workflow.statuses.set(full.id, "running");
    }
    return full;
  };
  return {
    ...memory,
    access,
    call,
    env,
    handle,
    listed,
    seed,
    status,
    store,
    workflow,
  };
};
