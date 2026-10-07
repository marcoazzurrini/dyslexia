import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";

import { NarrationsApi } from "./api.ts";
import type { Narration } from "./narration.ts";

export type { Narration, Stage } from "./narration.ts";

/** Why a request about narrations failed. */
export type NarrationsErrorKind =
  | "signed-out"
  | "invalid-link"
  | "busy"
  | "not-found"
  | "conflict"
  | "unavailable";

const MESSAGES: Record<NarrationsErrorKind, string> = {
  busy: "Five narrations are already being made. Wait for one to finish.",
  conflict: "This narration is still being made.",
  "invalid-link": "Use a public link that starts with https://.",
  "not-found": "This narration no longer exists.",
  "signed-out": "Your session ended. Sign in again.",
  unavailable: "The narration service could not be reached. Try again.",
};

/** A failed request about narrations, with a message for the listener. */
export class NarrationsError extends Error {
  readonly kind: NarrationsErrorKind;

  constructor(kind: NarrationsErrorKind) {
    super(MESSAGES[kind]);
    this.name = "NarrationsError";
    this.kind = kind;
  }
}

// Every failure the API declares, and the client's own: network, HTTP,
// and decoding errors, which leave the service unavailable.
const KINDS = new Map<string, NarrationsErrorKind>([
  ["CouldNotStart", "unavailable"],
  ["Forbidden", "signed-out"],
  ["InvalidLink", "invalid-link"],
  ["NarrationNotFound", "not-found"],
  ["NotConfigured", "unavailable"],
  ["TooManyInProgress", "busy"],
  ["Unauthorized", "signed-out"],
  ["WrongState", "conflict"],
]);

interface Tagged {
  readonly _tag: string;
}

type Client = Effect.Success<ReturnType<typeof makeClient>>;

const makeClient = () =>
  HttpApiClient.make(NarrationsApi, { baseUrl: globalThis.location.origin });

const call = <A, E extends Tagged>(
  request: (client: Client) => Effect.Effect<A, E>,
  signal?: AbortSignal
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(request),
      Effect.mapError(
        ({ _tag }) => new NarrationsError(KINDS.get(_tag) ?? "unavailable")
      ),
      Effect.provide(FetchHttpClient.layer)
    ),
    { signal }
  );

/** The newest narrations first. */
export const listNarrations = (
  signal?: AbortSignal
): Promise<readonly Narration[]> => call((client) => client.list(), signal);

/** Starts making a narration of the article at `url`. */
export const startNarration = (url: string): Promise<Narration> =>
  call((client) => client.start({ payload: { url } }));

/** Makes a failed narration again. Returns the new narration. */
export const retryNarration = (id: string): Promise<Narration> =>
  call((client) => client.retry({ params: { id } }));

/** Deletes a narration that is ready or failed. */
export const removeNarration = async (id: string): Promise<void> => {
  await call((client) => client.remove({ params: { id } }));
};
