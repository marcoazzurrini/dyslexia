import { describe, expect, test } from "bun:test";

import { Result } from "effect";

import { plan, scriptJsonSchema, spokenText } from "../src/making.ts";
import type { Plan, Script } from "../src/making.ts";
import { holds, PAGE, scripts, spokenOf } from "./support.ts";

const MAX = 120;

const planned = (script: Script, max = MAX) => plan(PAGE, script, max);

/** Each item's words, put back together from the parts' spans. */
const rebuilt = (result: Plan) => {
  const texts = result.items.map(() => "");
  for (const part of result.parts) {
    for (const [item, from, to, at] of part.spans) {
      if (texts[item]?.length !== from) {
        return;
      }
      texts[item] += part.text.slice(at, at + to - from);
    }
  }
  return texts;
};

describe("planning the parts to record", () => {
  test("loses nothing: the parts hold every item's words, once, in order", async () => {
    await holds(scripts(), (script) => {
      const result = planned(script);
      if (Result.isFailure(result)) {
        return spokenText(script) === "";
      }
      const { items } = result.success;
      const texts = rebuilt(result.success);
      return (
        texts !== undefined &&
        texts.every((text, index) => {
          const item = items[index];
          return item !== undefined && text === spokenOf(item);
        })
      );
    });
  });

  test("keeps every part within the limit", async () => {
    await holds(scripts(), (script) => {
      const result = planned(script, 40);
      return (
        Result.isFailure(result) ||
        result.success.parts.every(({ text }) => text.length <= 40)
      );
    });
  });

  test("says items in the order of the script", async () => {
    await holds(scripts(), (script) => {
      const result = planned(script);
      if (Result.isFailure(result)) {
        return true;
      }
      const order = result.success.parts.flatMap(({ spans }) =>
        spans.map(([item]) => item)
      );
      return order.every(
        (item, at) => at === 0 || item >= (order[at - 1] ?? 0)
      );
    });
  });

  test("shows the article's visual for each number", () => {
    const result = planned({
      items: [
        { kind: "paragraph", say: "A map.", visual: null },
        { kind: "visual", say: "", visual: 1 },
        { kind: "visual", say: "A diagram shows a box.", visual: 3 },
      ],
      title: "Caching",
    });
    expect(Result.getOrThrow(result).items).toEqual([
      { kind: "paragraph", text: "A map." },
      {
        kind: "visual",
        say: "",
        visual: {
          code: "const cache = new Map();",
          kind: "code",
          language: "js",
        },
      },
      {
        kind: "visual",
        say: "A diagram shows a box.",
        visual: {
          alt: "A diagram of a cache",
          kind: "image",
          src: "https://example.org/diagram.png",
        },
      },
    ]);
  });

  test("ends a long paragraph's parts at sentences", () => {
    const sentence = "Every word of this sentence counts. ";
    const result = planned({
      items: [{ kind: "paragraph", say: sentence.repeat(10), visual: null }],
      title: "Caching",
    });
    const parts = Result.getOrThrow(result).parts.map(({ text }) => text);
    expect(parts.length).toBeGreaterThan(2);
    for (const part of parts.slice(0, -1)) {
      expect(part).toMatch(/counts\. $/u);
    }
  });

  test.each([
    [0, "It shows visual 0, which the article does not have."],
    [4, "It shows visual 4, which the article does not have."],
    [null, "It shows visual null, which the article does not have."],
  ])("refuses a script that shows visual %p", (visual, reason) => {
    const result = planned({
      items: [{ kind: "visual", say: "", visual }],
      title: "Caching",
    });
    expect(Result.isFailure(result) && result.failure.reason).toBe(reason);
  });

  test("refuses a script that says nothing", () => {
    const result = planned({
      items: [
        { kind: "paragraph", say: "  ", visual: null },
        { kind: "visual", say: "", visual: 1 },
      ],
      title: "Caching",
    });
    expect(Result.isFailure(result) && result.failure.reason).toBe(
      "It says nothing."
    );
  });

  test("describes the script strictly enough for structured output", () => {
    expect(scriptJsonSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        items: {
          items: {
            additionalProperties: false,
            required: ["kind", "say", "visual"],
          },
        },
      },
      required: ["items", "title"],
    });
  });
});
