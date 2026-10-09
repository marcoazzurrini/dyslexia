import { describe, expect, test } from "bun:test";

import { linkToRead } from "../src/services/reader-sites.ts";

describe("the link Firecrawl reads", () => {
  test.each([
    [
      "https://x.com/poteto/article/2094457600259842065?lang=en",
      "https://x.com/poteto/status/2094457600259842065",
    ],
    [
      "https://www.x.com/poteto/article/2094457600259842065",
      "https://x.com/poteto/status/2094457600259842065",
    ],
    [
      "https://mobile.twitter.com/poteto/article/2094457600259842065/",
      "https://x.com/poteto/status/2094457600259842065",
    ],
    [
      "https://twitter.com/some_one/article/42",
      "https://x.com/some_one/status/42",
    ],
  ])("reads the post that holds an X article: %s", (link, expected) => {
    expect(linkToRead(link)).toBe(expected);
  });

  test.each([
    [
      "https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f",
      "https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f/raw",
    ],
    [
      "https://gist.github.com/some-one/1234567/?tab=comments#file-notes-md",
      "https://gist.github.com/some-one/1234567/raw",
    ],
  ])("reads a gist without its comments: %s", (link, expected) => {
    expect(linkToRead(link)).toBe(expected);
  });

  test.each([
    "https://x.com/poteto/status/2094457600259842065?lang=en",
    // Names the article itself, not the post it was published in.
    "https://x.com/i/article/2094151284949688320",
    "https://x.com/poteto/article/2094457600259842065/media",
    "https://x.com/poteto",
    "https://notx.com/poteto/article/1",
    "https://x.com.example.org/poteto/article/1",
    "https://example.org/poteto/article/1",
    "https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f/raw",
    "https://gist.github.com/karpathy",
    "https://gist.github.com/karpathy/starred",
    "https://github.com/karpathy/442a6bf555914893e9891c11519de94f",
  ])("leaves any other link as it is: %s", (link) => {
    expect(linkToRead(link)).toBe(link);
  });
});
