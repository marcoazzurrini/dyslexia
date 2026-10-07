import { Clock, Effect } from "effect";

import { API_PATH } from "./config.ts";
import {
  INTERRUPTED,
  NarrationNotFound,
  TooManyInProgress,
  WrongState,
} from "./errors.ts";
import { MAX_IN_PROGRESS } from "./limits.ts";
import { normalizeLink } from "./link.ts";
import { stop } from "./making.ts";
import type { Narration, NarrationRecord } from "./narration.ts";
import { Engine } from "./services/engine.ts";
import { Store } from "./services/store.ts";

// What the API does with the library of narrations.

/** A narration is saved just before its run starts; allow for the gap. */
const START_GRACE_MS = 60_000;

/**
 * A run can end without cleaning up, as when Cloudflare gives up on it after
 * a crash. Finish the cleanup when the narration is next looked at.
 */
const settleStopped = Effect.fn("settleStopped")(function* settleStopped(
  record: NarrationRecord
) {
  if (record.state !== "making") {
    return record;
  }
  const now = yield* Clock.currentTimeMillis;
  if (now - Date.parse(record.createdAt) < START_GRACE_MS) {
    return record;
  }
  if (yield* (yield* Engine).isRunning(record.id)) {
    return record;
  }
  return yield* stop(record.id, INTERRUPTED);
});

/** The newest narrations first. */
export const list = Effect.gen(function* listAll() {
  const records = yield* (yield* Store).list;
  return yield* Effect.forEach(records, settleStopped, { concurrency: 4 });
}).pipe(Effect.withSpan("library.list"));

/** Saves a new narration and starts making it. */
export const start = Effect.fn("library.start")(function* libraryStart(
  link: string
) {
  const url = yield* normalizeLink(link);
  const making = (yield* list).filter((record) => record.state === "making");
  if (making.length >= MAX_IN_PROGRESS) {
    return yield* new TooManyInProgress();
  }
  const store = yield* Store;
  const record = yield* store.create(url);
  yield* (yield* Engine)
    .start(record.id)
    .pipe(Effect.tapError(() => store.remove(record.id)));
  return record;
});

/** Makes a failed narration again, in place of the failed one. */
export const retry = Effect.fn("library.retry")(function* libraryRetry(
  id: string
) {
  const store = yield* Store;
  const record = yield* store.get(id).pipe(Effect.flatMap(settleStopped));
  if (record.state !== "failed") {
    return yield* new WrongState();
  }
  // The saved link was checked when the narration started.
  const next = yield* start(record.url).pipe(
    Effect.catchTag("InvalidLink", (error) => Effect.die(error))
  );
  yield* store.remove(id);
  return next;
});

/** Deletes a narration that is ready or failed, with its audio. */
export const remove = Effect.fn("library.remove")(function* libraryRemove(
  id: string
) {
  const store = yield* Store;
  const record = yield* store.get(id).pipe(Effect.flatMap(settleStopped));
  if (record.state === "making") {
    return yield* new WrongState();
  }
  yield* store.remove(id);
});

/** The finished recording, with byte ranges for seeking. */
export const audio = Effect.fn("library.audio")(function* libraryAudio(
  id: string,
  request: Request
) {
  const store = yield* Store;
  const record = yield* store.get(id);
  if (record.state !== "ready") {
    return yield* new NarrationNotFound();
  }
  return yield* store.audio(id, request);
});

/** A narration as the app sees it. */
export const present = (record: NarrationRecord): Narration =>
  record.state === "ready"
    ? { ...record, audioUrl: `${API_PATH}/${record.id}/audio` }
    : record;
