import { describe, expect, test } from "bun:test";

import { Arbitrary, Result, Schema } from "effect";

import { positionAt, TranscriptSchema } from "../src/index.ts";
import type { Transcript } from "../src/index.ts";
import { assemble, plan } from "../src/making.ts";
import { holds, PAGE, record, scripts } from "./support.ts";

const words = new Intl.Segmenter("en", { granularity: "word" });

/** Transcripts of generated scripts, recorded by the steady test voice. */
const transcripts: Arbitrary.Arbitrary<Transcript> = Arbitrary.filterMap(
  scripts(),
  (script) =>
    Result.map(plan(PAGE, script, 120), (planned) =>
      assemble(planned, record(planned))
    )
);

const isSpoken = (item: Transcript["items"][number]) => item.end > item.start;

describe("timing the transcript", () => {
  test("keeps items in order, within the recording", async () => {
    await holds(transcripts, ({ duration, items }) =>
      items.every(
        (item, index) =>
          item.start >= 0 &&
          item.start <= item.end &&
          item.end <= duration &&
          (index === 0 || item.start >= (items[index - 1]?.start ?? 0))
      )
    );
  });

  test("times every word of what is shown, in order", async () => {
    await holds(transcripts, ({ duration, items }) =>
      items.every((item) => {
        if (item.kind === "visual") {
          return true;
        }
        const expected = [...words.segment(item.text)].filter(
          (segment) => segment.isWordLike
        );
        return (
          item.words.length === expected.length &&
          item.words.every(
            ([from, to, start], index) =>
              item.text.slice(from, to) === expected[index]?.segment &&
              start >= 0 &&
              start <= duration &&
              (index === 0 || start >= (item.words[index - 1]?.[2] ?? 0))
          )
        );
      })
    );
  });

  test("places visuals the voice leaves out without time of their own", async () => {
    await holds(transcripts, ({ items }) =>
      items.every(
        (item) => item.kind !== "visual" || item.say !== "" || !isSpoken(item)
      )
    );
  });

  test("finds each item the voice says at its start", async () => {
    await holds(transcripts, (transcript) =>
      transcript.items.every(
        (item, index) =>
          !isSpoken(item) || positionAt(transcript, item.start)?.item === index
      )
    );
  });

  test("moves only forward as the recording plays", async () => {
    await holds(transcripts, (transcript) => {
      let previous = { item: -1, word: -1 };
      for (let seconds = 0; seconds <= transcript.duration; seconds += 0.25) {
        const position = positionAt(transcript, seconds);
        if (!position) {
          return false;
        }
        const word = position.word ?? -1;
        if (
          position.item < previous.item ||
          (position.item === previous.item && word < previous.word)
        ) {
          return false;
        }
        previous = { item: position.item, word };
      }
      return true;
    });
  });

  test("survives being saved and read back", async () => {
    const codec = Schema.fromJsonString(TranscriptSchema);
    await holds(transcripts, (transcript) => {
      const json = Schema.encodeSync(codec)(transcript);
      return (
        JSON.stringify(Schema.decodeUnknownSync(codec)(json)) ===
        JSON.stringify(transcript)
      );
    });
  });

  test("adds up the parts' lengths, and times words across parts", () => {
    const script = {
      items: [
        { kind: "heading" as const, say: "Caching", visual: null },
        { kind: "visual" as const, say: "", visual: 1 },
        {
          kind: "paragraph" as const,
          say: "Caches keep answers close.",
          visual: null,
        },
      ],
      title: "Caching",
    };
    const planned = Result.getOrThrow(plan(PAGE, script, 10));
    expect(planned.parts.map(({ text }) => text)).toEqual([
      "Caching",
      "Caches ",
      "keep ",
      "answers ",
      "close.",
    ]);
    const transcript = assemble(
      planned,
      planned.parts.map(({ text }) => ({
        seconds: 2,
        starts: Array.from({ length: text.length }, (_, at) => at * 0.1),
      }))
    );
    expect(transcript.duration).toBe(10);
    expect(transcript.items).toEqual([
      {
        end: 2,
        kind: "heading",
        start: 0,
        text: "Caching",
        words: [[0, 7, 0]],
      },
      {
        end: 2,
        kind: "visual",
        say: "",
        start: 2,
        visual: {
          code: "const cache = new Map();",
          kind: "code",
          language: "js",
        },
      },
      {
        end: 10,
        kind: "paragraph",
        start: 2,
        text: "Caches keep answers close.",
        words: [
          [0, 6, 2],
          [7, 11, 4],
          [12, 19, 6],
          [20, 25, 8],
        ],
      },
    ]);
  });

  test("refuses recordings that do not match the plan", () => {
    const planned = Result.getOrThrow(
      plan(
        PAGE,
        {
          items: [{ kind: "paragraph", say: "Hello.", visual: null }],
          title: "x",
        },
        100
      )
    );
    expect(() => assemble(planned, [])).toThrow("Expected 1 recorded parts");
    expect(() => assemble(planned, [{ seconds: 1, starts: [0] }])).toThrow(
      "Part 1 was not recorded as planned"
    );
  });
});

describe("following the voice", () => {
  const transcript: Transcript = {
    duration: 10,
    items: [
      {
        end: 4,
        kind: "heading",
        start: 1,
        text: "Caching",
        words: [[0, 7, 1]],
      },
      {
        end: 4,
        kind: "visual",
        say: "",
        start: 4,
        visual: { alt: "", kind: "image", src: "https://example.org/a.png" },
      },
      {
        end: 10,
        kind: "paragraph",
        start: 4,
        text: "Keep it close.",
        words: [
          [0, 4, 4],
          [5, 7, 5],
          [8, 13, 6],
        ],
      },
    ],
    version: 1,
  };

  test.each([
    [0, { item: 0, word: undefined }],
    [1, { item: 0, word: 0 }],
    [3.9, { item: 0, word: 0 }],
    [4, { item: 2, word: 0 }],
    [5.5, { item: 2, word: 1 }],
    [99, { item: 2, word: 2 }],
  ])("at %p seconds, is at %p", (seconds, position) => {
    expect(positionAt(transcript, seconds)).toEqual(position);
  });

  test("is nowhere when the voice says nothing", () => {
    expect(
      positionAt({ duration: 0, items: [], version: 1 }, 0)
    ).toBeUndefined();
  });
});
