import { Context, Effect, Schedule } from "effect";

import {
  ArticleTooLong,
  isTransient,
  reasonFor,
  ScriptIncomplete,
} from "./errors.ts";
import type { MakingError } from "./errors.ts";
import {
  MAX_ARTICLE_CHARACTERS,
  MAX_SCRIPT_CHARACTERS,
  RETRIES,
} from "./limits.ts";
import type { NarrationRecord } from "./narration.ts";
import { coversArticle, splitIntoParts } from "./script.ts";
import { Reader } from "./services/reader.ts";
import type { Article } from "./services/reader.ts";
import { Store } from "./services/store.ts";
import { Voice } from "./services/voice.ts";
import { Writer } from "./services/writer.ts";

// Each function here is one durable step of making a narration. A step
// either succeeds or fails with a reason for the listener; the workflow
// decides what runs next.

/** The wait between attempts after a failure that may pass. */
export const RetrySchedule = Context.Reference<
  Schedule.Schedule<unknown, unknown>
>("narrations/RetrySchedule", {
  defaultValue: () => Schedule.exponential("2 seconds").pipe(Schedule.jittered),
});

const withRetries = <A, R>(effect: Effect.Effect<A, MakingError, R>) =>
  Effect.gen(function* retried() {
    const schedule = yield* RetrySchedule;
    return yield* Effect.retry(effect, {
      schedule,
      times: RETRIES,
      while: isTransient,
    });
  });

const basics = ({ createdAt, id, title, url }: NarrationRecord) => ({
  createdAt,
  id,
  title,
  url,
});

/** Saves what a narration in progress is doing. */
const advance = Effect.fn("advance")(function* advance(
  id: string,
  changes: Pick<
    Extract<NarrationRecord, { state: "making" }>,
    "stage" | "progress"
  > & { readonly title?: string }
) {
  const store = yield* Store;
  const record = yield* store.get(id).pipe(Effect.orDie);
  yield* store.save({ ...basics(record), state: "making", ...changes });
});

/** Reads the article and checks that it is short enough to narrate. */
export const readArticle = Effect.fn("readArticle")(function* readArticle(
  id: string
) {
  const record = yield* (yield* Store).get(id).pipe(Effect.orDie);
  const reader = yield* Reader;
  const article = yield* withRetries(reader.read(record.url));
  if (article.text.length > MAX_ARTICLE_CHARACTERS) {
    return yield* new ArticleTooLong({ characters: article.text.length });
  }
  yield* advance(id, { stage: "writing", title: article.title });
  return article;
});

/**
 * Rewrites the article to be read aloud and splits the script into the parts
 * to record. A script that leaves out part of the article is written again.
 */
export const writeScript = Effect.fn("writeScript")(function* writeScript(
  id: string,
  article: Article
) {
  const writer = yield* Writer;
  const script = yield* withRetries(
    writer.write(article).pipe(
      Effect.filterOrFail(
        (text) =>
          text.length <= MAX_SCRIPT_CHARACTERS &&
          coversArticle(article.text, text),
        () => new ScriptIncomplete()
      )
    )
  );
  const parts = splitIntoParts(script);
  yield* advance(id, {
    progress: { done: 0, total: parts.length },
    stage: "recording",
  });
  return parts;
});

/** Records one part of the script. */
export const recordPart = Effect.fn("recordPart")(function* recordPart(
  id: string,
  index: number,
  text: string
) {
  const voice = yield* Voice;
  const audio = yield* withRetries(voice.speak(text));
  yield* (yield* Store).savePart(id, index, audio);
  return index;
});

/** Saves how many parts are recorded. */
export const reportProgress = (id: string, done: number, total: number) =>
  advance(id, { progress: { done, total }, stage: "recording" }).pipe(
    Effect.as(done)
  );

/** Joins the parts into one recording and marks the narration ready. */
export const publish = Effect.fn("publish")(function* publish(
  id: string,
  count: number
) {
  const store = yield* Store;
  const durationSeconds = yield* store.joinParts(id, count);
  const record = yield* store.get(id).pipe(Effect.orDie);
  yield* store.save({ ...basics(record), durationSeconds, state: "ready" });
  return durationSeconds;
});

/** Deletes everything a narration made and marks it failed. */
export const stop = Effect.fn("stop")(function* stop(
  id: string,
  reason: string
) {
  const store = yield* Store;
  yield* store.clear(id);
  const record = yield* store.get(id).pipe(Effect.orDie);
  const failed: NarrationRecord = {
    ...basics(record),
    reason,
    state: "failed",
  };
  yield* store.save(failed);
  return failed;
});

/** A step's result, which Cloudflare saves between steps. */
export type Outcome<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly reason: string };

/** Turns an expected failure into a result, so only defects throw. */
export const settle = <A, R>(
  effect: Effect.Effect<A, MakingError, R>
): Effect.Effect<Outcome<A>, never, R> =>
  Effect.match(effect, {
    onFailure: (error) => ({ ok: false, reason: reasonFor(error) }),
    onSuccess: (value) => ({ ok: true, value }),
  });
