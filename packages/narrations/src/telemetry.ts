import { Duration, Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import {
  OtlpExporter,
  OtlpSerialization,
  OtlpTracer,
} from "effect/observability";

// Honeycomb files traces under the environment its key belongs to, so a
// development key keeps local runs apart from production.
const TRACES_URL = "https://api.honeycomb.io/v1/traces";

/**
 * Sends traces to Honeycomb when a key is set, and nothing otherwise.
 * Finished spans wait until `flushTraces` sends them: a Worker may stop as
 * soon as it has answered, so a timer could lose them.
 */
export const tracingFor = (env: {
  readonly HONEYCOMB_API_KEY?: string | undefined;
}) => {
  const key = env.HONEYCOMB_API_KEY?.trim();
  if (!key) {
    return OtlpExporter.layerFlusher;
  }
  return OtlpTracer.layer({
    exportInterval: Duration.infinity,
    headers: { "x-honeycomb-team": key },
    resource: { serviceName: "narrations" },
    url: TRACES_URL,
  }).pipe(
    Layer.provide(OtlpSerialization.layerJson),
    Layer.provide(FetchHttpClient.layer)
  );
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
