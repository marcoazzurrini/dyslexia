import { expect } from "bun:test";

import { Arbitrary, Effect, Schema } from "effect";

import type { Page, Plan, Recorded, Script } from "../src/making.ts";

/** Checks a property on generated values, and reports the smallest failure. */
export const holds = async <A>(
  values: Arbitrary.Arbitrary<A>,
  property: (value: A) => boolean,
  runs = 300
) => {
  const result = await Effect.runPromise(
    Arbitrary.checkEffect(values, property, { runs })
  );
  expect(Arbitrary.formatCheckFailure(result)).toBeUndefined();
};

/** An article with three visuals: code, a table, and a picture. */
export const PAGE: Page = {
  markdown: [
    "# Caching",
    "Caches keep answers close.",
    "```js\nconst cache = new Map();\n```",
    "| Layer | Speed |\n| --- | --- |\n| Memory | Fast |",
    "![A diagram of a cache](/diagram.png)",
    "That is all.",
  ].join("\n\n"),
  title: "Caching",
  url: "https://example.org/posts/caching",
};

const WORDS = [
  "cache",
  "the",
  "reader",
  "follows",
  "every",
  "word",
  "naïve",
  "😀",
  "API",
  "3.5",
  "don't",
  "co-operate",
  "line\nbreak",
  "[sighs]",
];

const index = (maximum: number) =>
  Schema.Int.check(Schema.isBetween({ maximum, minimum: 0 }));

/**
 * Text of words, with sentences, line breaks, the odd emoji, and directions
 * to the voice.
 */
const textOf = (picks: readonly number[]) =>
  picks
    .map(
      (pick, at) => `${WORDS[pick % WORDS.length]}${at % 6 === 5 ? "." : ""}`
    )
    .join(" ");

const ItemSeed = Schema.Struct({
  kind: index(2),
  say: Schema.Array(index(40)).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(60)
  ),
  visual: index(2),
});

/**
 * Scripts for `PAGE`: headings, paragraphs, and visuals that the voice says
 * or leaves out.
 */
export const scripts = (): Arbitrary.Arbitrary<Script> =>
  Arbitrary.map(
    Arbitrary.schema(
      Schema.Array(ItemSeed).check(
        Schema.isMinLength(1),
        Schema.isMaxLength(25)
      )
    ),
    (seeds) => ({
      items: seeds.map((seed, at) => {
        // The first item is always said, so most scripts can be recorded.
        const kind =
          at === 0
            ? "heading"
            : ((["heading", "paragraph", "visual"] as const)[seed.kind] ??
              "paragraph");
        const say =
          kind === "visual" && seed.say.length % 3 === 0
            ? ""
            : textOf(seed.say);
        return {
          kind,
          say,
          visual: kind === "visual" ? (seed.visual % 3) + 1 : null,
        };
      }),
      title: "Caching",
    })
  );

/** A voice that says 20 characters a second, with a pause after each part. */
export const record = (plan: Plan): Recorded[] =>
  plan.parts.map(({ text }) => ({
    seconds: text.length * 0.05 + 0.4,
    starts: Array.from({ length: text.length }, (_, at) => at * 0.05),
  }));

export const spokenOf = (item: Plan["items"][number]) =>
  item.kind === "visual" ? item.say : item.text;
