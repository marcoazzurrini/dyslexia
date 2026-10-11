import { describe, expect, test } from "bun:test";

import { prepare } from "../src/making.ts";
import { PAGE } from "./support.ts";

const blocksOf = (markdown: string) =>
  prepare({ markdown, title: "Title", url: "https://example.org/a/post" })
    .blocks;

describe("preparing an article for the writer", () => {
  test("numbers code, tables, and pictures, and keeps text as written", () => {
    expect(prepare(PAGE)).toEqual({
      blocks: [
        { markdown: "# Caching" },
        { markdown: "Caches keep answers close." },
        { markdown: "```js\nconst cache = new Map();\n```", visual: 1 },
        {
          markdown: "| Layer | Speed |\n| --- | --- |\n| Memory | Fast |",
          visual: 2,
        },
        { markdown: "![A diagram of a cache](/diagram.png)", visual: 3 },
        { markdown: "That is all." },
      ],
      title: "Caching",
    });
  });

  test("keeps lists, quotes, and inline formatting as text", () => {
    expect(
      blocksOf("- one\n- *two*\n\n> A quote with `code`.\n\nSee [this](/x).")
    ).toEqual([
      { markdown: "- one\n- *two*" },
      { markdown: "> A quote with `code`." },
      { markdown: "See [this](/x)." },
    ]);
  });

  test("treats a picture inside a sentence as text", () => {
    expect(blocksOf("Click ![the icon](/i.png) to start.")).toEqual([
      { markdown: "Click ![the icon](/i.png) to start." },
    ]);
  });

  test("numbers each picture of a row, and pictures wrapped in links", () => {
    expect(
      blocksOf("[![First](/1.png)](/big1.png) ![Second](https://cdn.org/2.png)")
    ).toEqual([
      { markdown: "![First](https://example.org/1.png)", visual: 1 },
      { markdown: "![Second](https://cdn.org/2.png)", visual: 2 },
    ]);
  });

  test("leaves out pictures without a web address, and breaks", () => {
    expect(
      blocksOf(
        "Before.\n\n![Inline](data:image/png;base64,AAAA)\n\n---\n\nAfter."
      )
    ).toEqual([{ markdown: "Before." }, { markdown: "After." }]);
  });

  test("reads Windows line endings", () => {
    expect(blocksOf("One.\r\n\r\nTwo.")).toEqual([
      { markdown: "One." },
      { markdown: "Two." },
    ]);
  });
});
