import { describe, expect, test } from "bun:test";

import {
  ArticleTooLong,
  ArticleUnreadable,
  isTransient,
  reasonFor,
  ScriptIncomplete,
  ServiceRejected,
  ServiceUnavailable,
} from "../src/errors.ts";

describe("failure reasons", () => {
  test("say why each failure happened, in plain words", () => {
    expect(reasonFor(new ArticleUnreadable())).toContain("could not be read");
    expect(reasonFor(new ArticleTooLong({ characters: 123_456 }))).toBe(
      "This article is too long to narrate: 123,456 characters, and the limit is 100,000."
    );
    expect(reasonFor(new ScriptIncomplete())).toContain("incomplete answers");
    expect(reasonFor(new ServiceUnavailable({ service: "voice" }))).toBe(
      "The voice service did not respond, even after several tries."
    );
    expect(
      reasonFor(new ServiceRejected({ service: "writer", status: 402 }))
    ).toBe(
      "The writing service refused the request (status 402). Check its API key and credit."
    );
    expect(
      reasonFor(new ServiceUnavailable({ service: "reader" }))
    ).toStartWith("The article reader");
  });

  test("retry only failures that may pass", () => {
    expect(isTransient(new ServiceUnavailable({ service: "reader" }))).toBe(
      true
    );
    expect(isTransient(new ScriptIncomplete())).toBe(true);
    expect(isTransient(new ArticleUnreadable())).toBe(false);
    expect(isTransient(new ArticleTooLong({ characters: 1 }))).toBe(false);
    expect(
      isTransient(new ServiceRejected({ service: "voice", status: 401 }))
    ).toBe(false);
  });
});
