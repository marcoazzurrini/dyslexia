import { Schema } from "effect";

/** A time in the recording, in seconds from its start. */
const Seconds = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

/** Something the article shows rather than says. */
export const VisualSchema = Schema.Union([
  Schema.Struct({
    alt: Schema.String,
    kind: Schema.Literal("image"),
    src: Schema.String,
  }),
  Schema.Struct({
    code: Schema.String,
    kind: Schema.Literal("code"),
    language: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    head: Schema.Array(Schema.String),
    kind: Schema.Literal("table"),
    rows: Schema.Array(Schema.Array(Schema.String)),
  }),
]);
export type Visual = typeof VisualSchema.Type;

/**
 * A spoken word: where it is in its item's text, from and to, and when the
 * voice starts saying it.
 */
const WordSchema = Schema.Tuple([Schema.Int, Schema.Int, Seconds]);

/** A heading or paragraph, shown exactly as the voice says it. */
const SpokenTextSchema = Schema.Struct({
  end: Seconds,
  kind: Schema.Literals(["heading", "paragraph"]),
  start: Seconds,
  text: Schema.String,
  words: Schema.Array(WordSchema),
});

/**
 * A visual, shown as in the article. `say` is what the voice says for it,
 * such as a code block read aloud or a picture described; empty when the
 * voice leaves it out, and then `start` equals `end`.
 */
const ShownVisualSchema = Schema.Struct({
  end: Seconds,
  kind: Schema.Literal("visual"),
  say: Schema.String,
  start: Seconds,
  visual: VisualSchema,
});

export const TranscriptItemSchema = Schema.Union([
  SpokenTextSchema,
  ShownVisualSchema,
]);
export type TranscriptItem = typeof TranscriptItemSchema.Type;

/** A narration's text, timed against its recording. */
export const TranscriptSchema = Schema.Struct({
  duration: Seconds,
  items: Schema.Array(TranscriptItemSchema),
  version: Schema.Literal(1),
});
export type Transcript = typeof TranscriptSchema.Type;
