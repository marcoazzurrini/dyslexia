import { describe, expect, test } from "bun:test";

import { MAX_PART_CHARACTERS } from "../src/limits.ts";
import { splitIntoParts } from "../src/script.ts";

const sentence = (index: number) =>
  `Sentence number ${index} tells part of the story. `;
const prose = (characters: number) => {
  let text = "";
  for (let index = 0; text.length < characters; index += 1) {
    text += sentence(index);
  }
  return text.slice(0, characters);
};

describe("splitting a script into parts", () => {
  test("keeps a short script whole", () => {
    expect(splitIntoParts("A short script.")).toEqual(["A short script."]);
  });

  test("gives nothing for a blank script", () => {
    expect(splitIntoParts(" \n\r\n ")).toEqual([]);
  });

  test("joins back into the normalized script", () => {
    const script = `  ${prose(9000)}\r\n\r\n${prose(4000)}\r${prose(2000)}  `;
    const parts = splitIntoParts(script);
    expect(parts.join("")).toBe(script.replaceAll(/\r\n?/gu, "\n").trim());
  });

  test("never exceeds the voice service's limit", () => {
    const parts = splitIntoParts(prose(50_000));
    expect(parts.length).toBeGreaterThan(16);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(MAX_PART_CHARACTERS);
    }
  });

  test("prefers to end a part at a paragraph", () => {
    const first = prose(2000);
    const [part] = splitIntoParts(`${first}\n\n${prose(2500)}`);
    expect(part).toBe(`${first}\n\n`);
  });

  test("ends a part at a sentence when there is no paragraph", () => {
    const parts = splitIntoParts(prose(7000));
    for (const part of parts.slice(0, -1)) {
      expect(part).toMatch(/\. $/u);
    }
  });

  test("cuts a long sentence at the limit", () => {
    const parts = splitIntoParts("a".repeat(MAX_PART_CHARACTERS * 2 + 10));
    expect(parts.map((part) => part.length)).toEqual([
      MAX_PART_CHARACTERS,
      MAX_PART_CHARACTERS,
      10,
    ]);
  });

  test("never splits a character in two", () => {
    const text = `${"a".repeat(MAX_PART_CHARACTERS - 1)}😀${"b".repeat(10)}`;
    const parts = splitIntoParts(text);
    expect(parts[0]).toBe("a".repeat(MAX_PART_CHARACTERS - 1));
    expect(parts.join("")).toBe(text);
  });
});
