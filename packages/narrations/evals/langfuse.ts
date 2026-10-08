import { Duration, Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import type { Shown } from "../src/observation.ts";

// The few calls the narration eval makes to Langfuse's public API:
// https://api.reference.langfuse.com

/** The eval's articles, and the scripts written from them, live here. */
export const DATASET = "narration-articles";

const env = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} in apps/web/.dev.vars.`);
  }
  return value;
};

const base = () =>
  (
    process.env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com"
  ).replace(/\/+$/u, "");

const request = (method: "GET" | "POST", path: string) =>
  HttpClientRequest.make(method)(`${base()}/api/public/${path}`).pipe(
    HttpClientRequest.basicAuth(
      env("LANGFUSE_PUBLIC_KEY"),
      env("LANGFUSE_SECRET_KEY")
    )
  );

// Langfuse's free plan answers at most 30 API calls a minute, and a run saves
// four scores per article, so it waits when told to.
const MAX_WAITS = 10;

/** Sends a request and decodes its JSON answer, or `null` for a 404. */
const call = <S extends Schema.Top>(
  schema: S,
  req: HttpClientRequest.HttpClientRequest
) =>
  Effect.gen(function* callLangfuse() {
    const client = yield* HttpClient.HttpClient;
    let response = yield* client.execute(req);
    for (
      let waits = 0;
      response.status === 429 && waits < MAX_WAITS;
      waits += 1
    ) {
      const seconds = Number(response.headers["retry-after"]) || 15;
      yield* Effect.sleep(Duration.seconds(seconds + 1));
      response = yield* client.execute(req);
    }
    if (response.status === 404) {
      return null;
    }
    if (response.status >= 300) {
      const text = yield* response.text;
      return yield* Effect.die(
        new Error(`Langfuse answered ${response.status}: ${text.slice(0, 300)}`)
      );
    }
    return yield* Schema.decodeUnknownEffect(schema)(yield* response.json);
  });

const DatasetSchema = Schema.Struct({ id: Schema.String, name: Schema.String });

/** An article saved for the eval. */
export const ItemInput = Schema.Struct({
  link: Schema.String,
  text: Schema.String,
  title: Schema.String,
});

const ItemSchema = Schema.Struct({
  id: Schema.String,
  input: ItemInput,
  metadata: Schema.Struct({
    case: Schema.String,
    heldOut: Schema.Boolean,
    tests: Schema.String,
  }),
  status: Schema.String,
});
export type Item = typeof ItemSchema.Type;

/** The eval's dataset, created the first time. */
export const ensureDataset = Effect.gen(function* ensureDataset() {
  const found = yield* call(
    DatasetSchema,
    request("GET", `v2/datasets/${DATASET}`)
  );
  if (found) {
    return found;
  }
  return yield* call(
    DatasetSchema,
    request("POST", "v2/datasets").pipe(
      HttpClientRequest.bodyJsonUnsafe({
        description:
          "Articles the narration eval scores scripts on. Their text is saved here, never in git.",
        name: DATASET,
      })
    )
  ).pipe(Effect.flatMap(Effect.fromNullishOr), Effect.orDie);
});

/** Dataset item ids are unique across the project, so they name the dataset. */
export const itemIdOf = (caseId: string) => `${DATASET}-${caseId}`;

export const findItem = (id: string) =>
  call(ItemSchema, request("GET", `dataset-items/${id}`));

export const saveItem = (item: {
  readonly id: string;
  readonly input: typeof ItemInput.Type;
  readonly metadata: Item["metadata"];
}) =>
  call(
    Schema.Struct({ id: Schema.String }),
    request("POST", "dataset-items").pipe(
      HttpClientRequest.bodyJsonUnsafe({ ...item, datasetName: DATASET })
    )
  );

/** Every active article in the dataset. */
export const listItems = call(
  Schema.Struct({ data: Schema.Array(ItemSchema) }),
  request("GET", "dataset-items").pipe(
    HttpClientRequest.setUrlParams({ datasetName: DATASET, limit: "100" })
  )
).pipe(
  Effect.map((page) =>
    (page?.data ?? []).filter((item) => item.status === "ACTIVE")
  )
);

/** Records a pass or fail on an article's script, with the judge's reason. */
export const saveScore = (score: {
  readonly traceId: string;
  readonly observationId: string;
  readonly name: string;
  readonly passed: boolean;
  readonly comment: string;
  readonly metadata?: Readonly<Record<string, Shown>>;
}) =>
  call(
    Schema.Struct({ id: Schema.String }),
    request("POST", "scores").pipe(
      HttpClientRequest.bodyJsonUnsafe({
        comment: score.comment,
        dataType: "BOOLEAN",
        environment: "experiment",
        metadata: score.metadata,
        name: score.name,
        observationId: score.observationId,
        traceId: score.traceId,
        value: score.passed ? 1 : 0,
      })
    )
  );
