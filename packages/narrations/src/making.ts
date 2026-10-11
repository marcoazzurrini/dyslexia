import type { Transcript } from "@dyslexia/transcript";
import { assemble, plan, spokenText } from "@dyslexia/transcript/making";
import type { Plan, Recorded } from "@dyslexia/transcript/making";
import { Context, Effect, Option, Schedule } from "effect";

import { API_PATH } from "./config.ts";
import {
  ArticleTooLong,
  isTransient,
  reasonFor,
  ScriptIncomplete,
} from "./errors.ts";
import type { MakingError } from "./errors.ts";
import {
  MAX_ARTICLE_CHARACTERS,
  MAX_PART_CHARACTERS,
  MAX_PICTURES,
  MAX_SCRIPT_CHARACTERS,
  RETRIES,
} from "./limits.ts";
import { measureMp3 } from "./mp3.ts";
import type { NarrationRecord } from "./narration.ts";
import { Pictures } from "./services/pictures.ts";
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
 * Rewrites the article to be read aloud, saves the title the writer gave it,
 * and plans the parts to record. An incomplete answer, one over the length
 * limit, or one that shows a visual the article does not have, is written
 * again.
 */
export const writeScript = Effect.fn("writeScript")(function* writeScript(
  id: string,
  article: Article
) {
  const record = yield* (yield* Store).get(id).pipe(Effect.orDie);
  const page = {
    markdown: article.text,
    title: article.title,
    url: record.url,
  };
  const writer = yield* Writer;
  const { planned, title } = yield* withRetries(
    writer.write(page).pipe(
      Effect.filterOrFail(
        (script) => spokenText(script).length <= MAX_SCRIPT_CHARACTERS,
        () => new ScriptIncomplete()
      ),
      Effect.flatMap((script) =>
        Effect.fromResult(plan(page, script, MAX_PART_CHARACTERS)).pipe(
          Effect.mapBoth({
            onFailure: () => new ScriptIncomplete(),
            onSuccess: (result) => ({ planned: result, title: script.title }),
          })
        )
      )
    )
  );
  yield* Effect.annotateCurrentSpan("script.parts", planned.parts.length);
  yield* advance(id, {
    progress: { done: 0, total: planned.parts.length },
    stage: "recording",
    title,
  });
  return planned;
});

/**
 * Records one part of the script, and returns how long it plays and when
 * each of its characters is said.
 */
export const recordPart = Effect.fn("recordPart")(function* recordPart(
  id: string,
  index: number,
  text: string
) {
  const voice = yield* Voice;
  const { audio, starts } = yield* withRetries(voice.speak(text));
  const seconds = measureMp3(audio);
  yield* (yield* Store).savePart(id, index, audio);
  return { seconds, starts } satisfies Recorded;
});

/** Saves how many parts are recorded. */
export const reportProgress = (id: string, done: number, total: number) =>
  advance(id, { progress: { done, total }, stage: "recording" }).pipe(
    Effect.as(done)
  );

/**
 * Keeps the pictures the script shows, so they outlive the page and the page
 * never learns who reads it. Returns where each kept picture is served, by
 * its address on the page. A picture that cannot be kept stays a link to the
 * page's own.
 */
export const keepPictures = Effect.fn("keepPictures")(function* keepPictures(
  id: string,
  planned: Plan
) {
  const addresses = [
    ...new Set(
      planned.items.flatMap((item) =>
        item.kind === "visual" && item.visual.kind === "image"
          ? [item.visual.src]
          : []
      )
    ),
  ].slice(0, MAX_PICTURES);
  const pictures = yield* Pictures;
  const store = yield* Store;
  const kept = yield* Effect.forEach(
    addresses,
    (address, index) =>
      pictures.fetch(address).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeed([]),
            onSome: (picture) =>
              store
                .savePicture(id, index, picture)
                .pipe(
                  Effect.as([
                    [address, `${API_PATH}/${id}/pictures/${index}`] as const,
                  ])
                ),
          })
        )
      ),
    { concurrency: 4 }
  );
  yield* Effect.annotateCurrentSpan({
    "narration.pictures": addresses.length,
    "narration.pictures_kept": kept.flat().length,
  });
  return Object.fromEntries(kept.flat());
});

/** The transcript, showing kept pictures in place of the page's. */
const showingKept = (
  transcript: Transcript,
  kept: Readonly<Record<string, string>>
): Transcript => ({
  ...transcript,
  items: transcript.items.map((item) =>
    item.kind === "visual" &&
    item.visual.kind === "image" &&
    kept[item.visual.src] !== undefined
      ? { ...item, visual: { ...item.visual, src: kept[item.visual.src] } }
      : item
  ),
});

/**
 * Joins the parts into one recording, saves its transcript, and marks the
 * narration ready.
 */
export const publish = Effect.fn("publish")(function* publish(
  id: string,
  planned: Plan,
  recorded: readonly Recorded[],
  kept: Readonly<Record<string, string>> = {}
) {
  const store = yield* Store;
  const transcript = showingKept(assemble(planned, recorded), kept);
  yield* store.saveTranscript(id, transcript);
  const durationSeconds = yield* store.joinParts(id, recorded.length);
  yield* Effect.annotateCurrentSpan(
    "narration.duration_seconds",
    durationSeconds
  );
  const record = yield* store.get(id).pipe(Effect.orDie);
  yield* store.save({
    ...basics(record),
    durationSeconds,
    state: "ready",
    transcript: true,
  });
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
