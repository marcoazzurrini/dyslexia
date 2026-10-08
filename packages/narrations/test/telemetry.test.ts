import { describe, expect, test } from "bun:test";

import { handleNarrations } from "../src/server.ts";
import { ORIGIN } from "./support/api.ts";
import { memoryBucket } from "./support/bucket.ts";
import { fakeWorkflow } from "./support/fakes.ts";
import { routeFetch } from "./support/network.ts";

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
