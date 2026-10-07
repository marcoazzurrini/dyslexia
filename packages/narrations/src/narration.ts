import { Schema } from "effect";

/** What a narration in progress is doing. */
export const StageSchema = Schema.Literals(["reading", "writing", "recording"]);
export type Stage = typeof StageSchema.Type;

const fields = {
  createdAt: Schema.String,
  id: Schema.String,
  /** The article's title, or its site until the article has been read. */
  title: Schema.String,
  /** The article's address. */
  url: Schema.String,
};

const Making = Schema.Struct({
  ...fields,
  /** Parts recorded so far, while recording. */
  progress: Schema.optionalKey(
    Schema.Struct({ done: Schema.Number, total: Schema.Number })
  ),
  stage: StageSchema,
  state: Schema.Literal("making"),
});

const Failed = Schema.Struct({
  ...fields,
  /** Why it failed, written for the listener. */
  reason: Schema.String,
  state: Schema.Literal("failed"),
});

const ready = {
  ...fields,
  durationSeconds: Schema.Number,
  state: Schema.Literal("ready"),
};

/** A narration as stored. */
export const NarrationRecordSchema = Schema.Union([
  Making,
  Schema.Struct(ready),
  Failed,
]);
export type NarrationRecord = typeof NarrationRecordSchema.Type;

/** A narration as the app sees it: being made, ready to play, or failed. */
export const NarrationSchema = Schema.Union([
  Making,
  Schema.Struct({ ...ready, audioUrl: Schema.String }),
  Failed,
]);
export type Narration = typeof NarrationSchema.Type;
