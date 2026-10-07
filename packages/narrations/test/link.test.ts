import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { normalizeLink } from "../src/link.ts";

const normalize = (value: string) =>
  Effect.runPromise(
    normalizeLink(value).pipe(
      Effect.catchTag("InvalidLink", () => Effect.succeed("invalid"))
    )
  );

describe("article links", () => {
  test.each([
    ["https://example.org/article", "https://example.org/article"],
    ["  https://example.org/a  ", "https://example.org/a"],
    ["HTTPS://Example.ORG/A?b=1", "https://example.org/A?b=1"],
    ["https://example.org./a", "https://example.org/a"],
    ["https://example.org:443/a", "https://example.org/a"],
    ["https://example.org/a#section", "https://example.org/a"],
    ["https://sub.domain.co.uk/path", "https://sub.domain.co.uk/path"],
  ])("accepts %s as %s", async (link, expected) => {
    expect(await normalize(link)).toBe(expected);
  });

  test.each([
    "http://example.org/a",
    "ftp://example.org/a",
    "example.org/a",
    "https://user:pass@example.org/a",
    "https://@example.org/a",
    "https://example.org:8443/a",
    "https://example.org:/a",
    "https://localhost/a",
    "https://printer.local/a",
    "https://intranet/a",
    "https://192.168.1.1/a",
    "https://10.0.0.1/a",
    "https://[::1]/a",
    "https://site.test/a",
    "https://exa mple.org/a",
    "https://example.org\\@evil.org/a",
    "https://-bad-.org/a",
    "",
    "not a link",
  ])("rejects %s", async (link) => {
    expect(await normalize(link)).toBe("invalid");
  });
});
