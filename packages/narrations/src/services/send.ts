import { Effect, Schema, Stream } from "effect";
import type { Duration } from "effect";
import { Headers, HttpClient } from "effect/http";
import type { HttpClientRequest } from "effect/http";

import { ServiceRejected, ServiceUnavailable } from "../errors.ts";
import type { Service } from "../errors.ts";

// Traces record request headers. ElevenLabs takes its key in one that Effect
// does not hide by default.
const REDACTED_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "xi-api-key",
];

const concat = (parts: readonly Uint8Array[], length: number) => {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
};

/**
 * Sends a request to a service and returns its answer, which must fit in
 * `limit` bytes. Failures that may pass on another attempt, such as network
 * errors, timeouts, rate limits, and server errors, become
 * `ServiceUnavailable`. Any other error status becomes `ServiceRejected`.
 */
export const send = (
  service: Service,
  request: HttpClientRequest.HttpClientRequest,
  options: { readonly limit: number; readonly timeout: Duration.Input }
): Effect.Effect<
  Uint8Array,
  ServiceUnavailable | ServiceRejected,
  HttpClient.HttpClient
> => {
  const unavailable = new ServiceUnavailable({ service });
  return Effect.gen(function* sendRequest() {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(request);
    const { status } = response;
    if (status === 408 || status === 429 || status >= 500) {
      return yield* unavailable;
    }
    if (status >= 400) {
      return yield* new ServiceRejected({ service, status });
    }
    const parts: Uint8Array[] = [];
    let length = 0;
    yield* Stream.runForEach(response.stream, (part) => {
      length += part.byteLength;
      parts.push(part);
      return length > options.limit ? Effect.fail(unavailable) : Effect.void;
    });
    return concat(parts, length);
  }).pipe(
    Effect.catchTag("HttpClientError", () => Effect.fail(unavailable)),
    Effect.timeoutOrElse({
      duration: options.timeout,
      orElse: () => Effect.fail(unavailable),
    }),
    Effect.provideService(Headers.CurrentRedactedNames, REDACTED_HEADERS)
  );
};

/** Decodes a JSON answer, or fails with `orElse` when it does not match. */
export const decodeJson =
  <S extends Schema.Top>(schema: S) =>
  <E>(bytes: Uint8Array, orElse: () => E) =>
    Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(
      new TextDecoder().decode(bytes)
    ).pipe(Effect.mapError(orElse));
