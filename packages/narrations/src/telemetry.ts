import { Duration, Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import {
  OtlpExporter,
  OtlpSerialization,
  OtlpTracer,
} from "effect/observability";

// API requests are traced in Honeycomb, and narration runs in Langfuse, which
// shows each run with the article, the prompt, and the script it produced.

/**
 * Sends traces to an OTLP endpoint. Finished spans wait until `flushTraces`
 * sends them: a Worker may stop as soon as it has answered, so a timer could
 * lose them.
 */
const otlpTracing = (options: {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly attributes?: Record<string, string>;
}) =>
  OtlpTracer.layer({
    exportInterval: Duration.infinity,
    headers: options.headers,
    resource: { attributes: options.attributes, serviceName: "narrations" },
    url: options.url,
  }).pipe(
    Layer.provide(OtlpSerialization.layerJson),
    Layer.provide(FetchHttpClient.layer)
  );

/**
 * Sends traces of API requests to Honeycomb when a key is set, and nothing
 * otherwise. Honeycomb files traces under the environment its key belongs
 * to, so a development key keeps local runs apart from production.
 */
export const tracingFor = (env: {
  readonly HONEYCOMB_API_KEY?: string | undefined;
}) => {
  const key = env.HONEYCOMB_API_KEY?.trim();
  return key
    ? otlpTracing({
        headers: { "x-honeycomb-team": key },
        url: "https://api.honeycomb.io/v1/traces",
      })
    : OtlpExporter.layerFlusher;
};

/** The Langfuse settings, all optional. */
export interface LangfuseEnv {
  readonly LANGFUSE_PUBLIC_KEY?: string | undefined;
  readonly LANGFUSE_SECRET_KEY?: string | undefined;
  /** Defaults to Langfuse's EU cloud. */
  readonly LANGFUSE_BASE_URL?: string | undefined;
  /** Keeps local runs apart from production. Defaults to `production`. */
  readonly LANGFUSE_TRACING_ENVIRONMENT?: string | undefined;
}

// Each service call is already a step of its own, with what it was given and
// what it returned, so the HTTP requests under it are left out.
const withoutHttpSpans = Layer.succeed(HttpClient.TracerDisabledWhen)(
  () => true
);

/**
 * Sends traces of narration runs to Langfuse when both its keys are set, and
 * nothing otherwise.
 */
export const narrationTracingFor = (env: LangfuseEnv) => {
  const publicKey = env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) {
    return Layer.merge(OtlpExporter.layerFlusher, withoutHttpSpans);
  }
  const base = (
    env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com"
  ).replace(/\/+$/u, "");
  const langfuse = otlpTracing({
    attributes: {
      "langfuse.environment":
        env.LANGFUSE_TRACING_ENVIRONMENT?.trim() || "production",
    },
    headers: {
      Authorization: `Basic ${btoa(`${publicKey}:${secretKey}`)}`,
      // Without it, new traces can take up to ten minutes to appear.
      "x-langfuse-ingestion-version": "4",
    },
    url: `${base}/api/public/otel/v1/traces`,
  });
  return Layer.merge(langfuse, withoutHttpSpans);
};

/** Sends the spans finished so far. Never fails, and gives up after a while. */
export const flushTraces = Effect.serviceOption(OtlpExporter.Flusher).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.void,
      onSome: ({ flush }) =>
        flush.pipe(Effect.timeoutOption("5 seconds"), Effect.asVoid),
    })
  )
);
