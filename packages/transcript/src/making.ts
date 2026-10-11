/**
 * Making a transcript, on the server: number the article's visuals for the
 * writer, check the script it writes and plan the parts to record, then time
 * the script against the recorded parts.
 *
 *   prepare(page)              what the writer reads
 *   plan(page, script, limit)  the parts to record, or why the script is unusable
 *   assemble(plan, recorded)   the transcript, timed against the recording
 */
import { Data, Result, Schema } from "effect";

import { parseBlocks } from "./blocks.ts";
import { TranscriptSchema, VisualSchema } from "./format.ts";
import type { Transcript, TranscriptItem, Visual } from "./format.ts";
import { splitText } from "./pieces.ts";

/** An article as read from its page. */
export interface Page {
  /** The article's text, in Markdown. */
  readonly markdown: string;
  readonly title: string;
  /** The page's link, against which picture addresses resolve. */
  readonly url: string;
}

/**
 * What the writer reads: the article in blocks, in order. A block with a
 * `visual` number is shown in the reader: a picture, code, or a table.
 */
export interface WriterInput {
  readonly title: string;
  readonly blocks: readonly (
    | { readonly markdown: string }
    | { readonly visual: number; readonly markdown: string }
  )[];
}

/** What the writer reads, from the article on a page. */
export const prepare = (page: Page): WriterInput => {
  let visuals = 0;
  return {
    blocks: parseBlocks(page.markdown, page.url).map((block) => {
      if (block.kind === "text") {
        return { markdown: block.markdown };
      }
      visuals += 1;
      return { markdown: block.markdown, visual: visuals };
    }),
    title: page.title,
  };
};

/**
 * What the writer writes: the script, item by item, and the title to list it
 * under. A heading or paragraph is said and shown as written. A visual item
 * shows the article's visual with that number where it stands, and `say` is
 * what the voice says for it, or nothing.
 */
export const ScriptSchema = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      kind: Schema.Literals(["heading", "paragraph", "visual"]),
      say: Schema.String,
      visual: Schema.NullOr(Schema.Int),
    })
  ),
  title: Schema.String,
});
export type Script = typeof ScriptSchema.Type;

/** The script's shape as JSON Schema, strict enough for structured output. */
export const scriptJsonSchema = Schema.toJsonSchemaDocument(ScriptSchema, {
  onExcessProperty: "error",
}).schema;

/** Everything the script says, as the voice will say it. */
export const spokenText = (script: Script) =>
  script.items
    .map((item) => item.say.trim())
    .filter(Boolean)
    .join("\n\n");

/** Why a script cannot be recorded. */
export class InvalidScript extends Data.TaggedError("InvalidScript")<{
  readonly reason: string;
}> {}

const PlannedItemSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literals(["heading", "paragraph"]),
    text: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("visual"),
    say: Schema.String,
    visual: VisualSchema,
  }),
]);
type PlannedItem = typeof PlannedItemSchema.Type;

/**
 * The script, checked, and the parts to record. Read each part's `text`;
 * the rest is for `assemble`. A plan is plain data, to save between steps.
 */
export const PlanSchema = Schema.Struct({
  items: Schema.Array(PlannedItemSchema),
  parts: Schema.Array(
    Schema.Struct({
      // Where items' words are in the part: the item, the stretch of its
      // words from and to, and where that stretch starts in the part.
      spans: Schema.Array(
        Schema.Tuple([Schema.Int, Schema.Int, Schema.Int, Schema.Int])
      ),
      text: Schema.String,
    })
  ),
});
export type Plan = typeof PlanSchema.Type;
type Part = Plan["parts"][number];

const spokenOf = (item: PlannedItem) =>
  item.kind === "visual" ? item.say : item.text;

const clean = (text: string) => text.replaceAll(/\r\n?/gu, "\n").trim();

// Items in one part are said one after another, as paragraphs.
const SEPARATOR = "\n\n";

const partsOf = (items: readonly PlannedItem[], max: number): Part[] => {
  const parts: Part[] = [];
  let text = "";
  let spans: [number, number, number, number][] = [];
  for (const [index, item] of items.entries()) {
    let from = 0;
    for (const piece of splitText(spokenOf(item), max)) {
      if (text && text.length + SEPARATOR.length + piece.length > max) {
        parts.push({ spans, text });
        text = "";
        spans = [];
      }
      if (text) {
        text += SEPARATOR;
      }
      spans.push([index, from, from + piece.length, text.length]);
      text += piece;
      from += piece.length;
    }
  }
  if (text) {
    parts.push({ spans, text });
  }
  return parts;
};

/**
 * Checks the script against the article it was written from, and splits
 * what it says into parts of at most `maxPartCharacters` for the voice. It
 * fails when the script shows a visual the article does not have, or says
 * nothing at all.
 */
export const plan = (
  page: Page,
  script: Script,
  maxPartCharacters: number
): Result.Result<Plan, InvalidScript> => {
  const visuals: Visual[] = parseBlocks(page.markdown, page.url).flatMap(
    (block) => (block.kind === "visual" ? [block.visual] : [])
  );
  const items: PlannedItem[] = [];
  for (const item of script.items) {
    const say = clean(item.say);
    if (item.kind === "visual") {
      const visual =
        item.visual === null ? undefined : visuals[item.visual - 1];
      if (!visual) {
        return Result.fail(
          new InvalidScript({
            reason: `It shows visual ${item.visual}, which the article does not have.`,
          })
        );
      }
      items.push({ kind: "visual", say, visual });
    } else if (say) {
      items.push({ kind: item.kind, text: say });
    }
  }
  const parts = partsOf(items, maxPartCharacters);
  if (parts.length === 0) {
    return Result.fail(new InvalidScript({ reason: "It says nothing." }));
  }
  return Result.succeed({ items, parts });
};

/** A recorded part: how long it plays, and when each character of its text starts. */
export const RecordedSchema = Schema.Struct({
  seconds: Schema.Finite,
  starts: Schema.Array(Schema.Finite),
});
export type Recorded = typeof RecordedSchema.Type;

const words = new Intl.Segmenter("en", { granularity: "word" });

const round = (seconds: number) => Math.round(seconds * 1000) / 1000;

/** The smallest step between two moments in a transcript. */
const TICK = 0.001;

/** When each character of each item is said, if it is. */
const characterTimes = (planned: Plan, recorded: readonly Recorded[]) => {
  const times = planned.items.map((item) =>
    Array.from<number | undefined>({ length: spokenOf(item).length })
  );
  let offset = 0;
  for (const [index, part] of planned.parts.entries()) {
    const take = recorded[index];
    if (!take || take.starts.length !== part.text.length) {
      throw new Error(`Part ${index + 1} was not recorded as planned`);
    }
    for (const [item, from, to, at] of part.spans) {
      const itemTimes = times[item] ?? [];
      for (let character = from; character < to; character += 1) {
        const start = take.starts[at + character - from] ?? 0;
        itemTimes[character] =
          offset + Math.min(Math.max(start, 0), take.seconds);
      }
    }
    offset += take.seconds;
  }
  return { duration: offset, times };
};

// A direction to the voice, such as [sighs], which the voice performs rather
// than says, with the space that sets it apart from the words.
const DIRECTION = /^\[[^\]\n]*\][ \t]*|[ \t]*\[[^\]\n]*\]/gmu;

/**
 * Text as it is shown, without directions to the voice, and where each of
 * its characters is in the text as it is said.
 */
const shown = (said: string) => {
  const hidden = Array.from({ length: said.length }, () => false);
  for (const { 0: direction, index } of said.matchAll(DIRECTION)) {
    hidden.fill(true, index, index + direction.length);
  }
  const at = hidden.flatMap((isHidden, index) => (isHidden ? [] : [index]));
  const text = at.map((index) => said[index]).join("");
  const from = text.length - text.trimStart().length;
  const to = text.trimEnd().length;
  return { at: at.slice(from, to), text: text.slice(from, to) };
};

/** The first time at or after `index`. */
const timeFrom = (times: readonly (number | undefined)[], index: number) =>
  times.slice(index).find((time) => time !== undefined);

/**
 * Times the plan's script against its recorded parts, given in order, and
 * returns the transcript. Each part must be recorded from its own text.
 */
export const assemble = (
  planned: Plan,
  recorded: readonly Recorded[]
): Transcript => {
  if (recorded.length !== planned.parts.length) {
    throw new Error(
      `Expected ${planned.parts.length} recorded parts, got ${recorded.length}`
    );
  }
  const { duration, times } = characterTimes(planned, recorded);
  // When each item starts, kept in order; undefined for an item not said.
  let previous = -TICK;
  const starts = planned.items.map((_, index) => {
    const first = timeFrom(times[index] ?? [], 0);
    if (first !== undefined) {
      previous = Math.max(round(first), previous + TICK);
    }
    return first === undefined ? first : previous;
  });
  const total = round(Math.max(duration, previous + TICK));
  const nextStart = (index: number) =>
    starts.slice(index + 1).find((start) => start !== undefined) ?? total;

  const items = planned.items.map((item, index): TranscriptItem => {
    const start = starts[index];
    const end = nextStart(index);
    if (item.kind === "visual") {
      return start === undefined
        ? { ...item, end, start: end }
        : { ...item, end, start };
    }
    const itemTimes = times[index] ?? [];
    const { at: said, text } = shown(item.text);
    return {
      ...item,
      end,
      start: start ?? end,
      text,
      words: [...words.segment(text)].flatMap(
        ({ index: at, isWordLike, segment }) => {
          const time = isWordLike
            ? timeFrom(itemTimes, said[at] ?? 0)
            : undefined;
          return time === undefined
            ? []
            : [[at, at + segment.length, round(time)] as const];
        }
      ),
    };
  });
  return Schema.decodeUnknownSync(TranscriptSchema)({
    duration: total,
    items,
    version: 1,
  });
};
