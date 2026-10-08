import { describe, expect, test } from "bun:test";

import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

import { handleNarrations } from "../src/server.ts";
import { flushTraces, narrationTracingFor } from "../src/telemetry.ts";
import { ORIGIN } from "./support/api.ts";
import { memoryBucket } from "./support/bucket.ts";
import { fakeWorkflow } from "./support/fakes.ts";
import { routeFetch } from "./support/network.ts";

interface Exported {
  readonly url: string;
  readonly headers: Headers;
  readonly body: string;
}

/** Records every request the exporters send. */
const recordExports = () => {
  const exports: Exported[] = [];
  routeFetch(async (request) => {
    exports.push({
      body: await request.text(),
      headers: request.headers,
      url: request.url,
    });
    return Response.json({});
  });
  return exports;
};

/** Runs one span through the narration tracing for `env` and sends it. */
const traceOneSpan = (env: Parameters<typeof narrationTracingFor>[0]) =>
  Effect.runPromise(
    Effect.void.pipe(
      Effect.withSpan("make narration"),
      Effect.andThen(flushTraces),
      Effect.provide(narrationTracingFor(env))
    )
  );

const LANGFUSE = {
  LANGFUSE_PUBLIC_KEY: "pk-lf-public",
  LANGFUSE_SECRET_KEY: "sk-lf-secret",
};

interface ExportedSpan {
  readonly name: string;
  readonly attributes: readonly { key: string; value: object }[];
}

const spanNamesIn = (body: string) =>
  // SAFETY: Effect's OTLP exporter sends JSON in this shape.
  (
    JSON.parse(body) as {
      resourceSpans: { scopeSpans: { spans: ExportedSpan[] }[] }[];
    }
  ).resourceSpans.flatMap(({ scopeSpans }) =>
    scopeSpans.flatMap(({ spans }) => spans.map((span) => span.name))
  );

describe("tracing the API", () => {
  test("sends a request's trace to Honeycomb once it has answered", async () => {
    const exports: { url: string; key: string | null; body: string }[] = [];
    routeFetch(async (request) => {
      exports.push({
        body: await request.text(),
        key: request.headers.get("x-honeycomb-team"),
        url: request.url,
      });
      return Response.json({});
    });
    const env = {
      AUDIO: memoryBucket().bucket,
      ELEVENLABS_API_KEY: "eleven-secret",
      FIRECRAWL_API_KEY: "firecrawl-secret",
      HONEYCOMB_API_KEY: "honeycomb-secret",
      NARRATION: fakeWorkflow().binding,
      OPENROUTER_API_KEY: "openrouter-secret",
    };
    const later: Promise<unknown>[] = [];
    const response = await handleNarrations(
      new Request(`${ORIGIN}/api/narrations`),
      env,
      { isSignedIn: () => Promise.resolve(true) },
      (promise) => later.push(promise)
    );
    expect(response.status).toBe(200);
    await Promise.all(later);
    expect(exports).toEqual([
      {
        body: expect.any(String),
        key: "honeycomb-secret",
        url: "https://api.honeycomb.io/v1/traces",
      },
    ]);
    expect(spanNamesIn(exports[0]?.body ?? "{}")).toContain("narrations.list");
  });
});

describe("tracing narration runs", () => {
  test("sends them to Langfuse with its keys, in production by default", async () => {
    const exports = recordExports();
    await traceOneSpan(LANGFUSE);
    expect(exports).toHaveLength(1);
    const [sent] = exports;
    expect(sent?.url).toBe(
      "https://cloud.langfuse.com/api/public/otel/v1/traces"
    );
    expect(sent?.headers.get("authorization")).toBe(
      `Basic ${btoa("pk-lf-public:sk-lf-secret")}`
    );
    expect(sent?.headers.get("x-langfuse-ingestion-version")).toBe("4");
    expect(spanNamesIn(sent?.body ?? "{}")).toEqual(["make narration"]);
    expect(sent?.body).toContain('"langfuse.environment"');
    expect(sent?.body).toContain('"production"');
  });

  test("uses the configured Langfuse address and environment", async () => {
    const exports = recordExports();
    await traceOneSpan({
      ...LANGFUSE,
      LANGFUSE_BASE_URL: "https://us.cloud.langfuse.com/",
      LANGFUSE_TRACING_ENVIRONMENT: "development",
    });
    expect(exports[0]?.url).toBe(
      "https://us.cloud.langfuse.com/api/public/otel/v1/traces"
    );
    expect(exports[0]?.body).toContain('"development"');
  });

  test("leaves out the HTTP requests under each step", async () => {
    const exports = recordExports();
    await Effect.runPromise(
      HttpClient.get("https://api.firecrawl.dev/v2/scrape").pipe(
        Effect.withSpan("Reader.read"),
        Effect.withSpan("make narration"),
        Effect.andThen(flushTraces),
        Effect.provide(FetchHttpClient.layer),
        Effect.provide(narrationTracingFor(LANGFUSE))
      )
    );
    const langfuse = exports.find(({ url }) => url.includes("langfuse"));
    expect(spanNamesIn(langfuse?.body ?? "{}").toSorted()).toEqual([
      "Reader.read",
      "make narration",
    ]);
  });

  test.each([
    ["no keys", {}],
    ["only the public key", { LANGFUSE_PUBLIC_KEY: "pk-lf-public" }],
    ["blank keys", { LANGFUSE_PUBLIC_KEY: " ", LANGFUSE_SECRET_KEY: " " }],
  ])("sends nothing with %s", async (_case, env) => {
    const exports = recordExports();
    await traceOneSpan(env);
    expect(exports).toEqual([]);
  });

  test("keeps API requests out of Langfuse", async () => {
    const exports = recordExports();
    const later: Promise<unknown>[] = [];
    await handleNarrations(
      new Request(`${ORIGIN}/api/narrations`),
      {
        ...LANGFUSE,
        AUDIO: memoryBucket().bucket,
        ELEVENLABS_API_KEY: "eleven-secret",
        FIRECRAWL_API_KEY: "firecrawl-secret",
        HONEYCOMB_API_KEY: "honeycomb-secret",
        NARRATION: fakeWorkflow().binding,
        OPENROUTER_API_KEY: "openrouter-secret",
      },
      { isSignedIn: () => Promise.resolve(true) },
      (promise) => later.push(promise)
    );
    await Promise.all(later);
    expect(exports.map(({ url }) => url)).toEqual([
      "https://api.honeycomb.io/v1/traces",
    ]);
  });
});
