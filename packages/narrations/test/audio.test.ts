import { describe, expect, test } from "bun:test";

import { serveAudioObject } from "../src/audio.ts";
import type { AudioBucket } from "../src/audio.ts";

const KEY = "recording.mp3";
const bytes = new TextEncoder().encode("0123456789");
const metadata = {
  etag: "recording-v1",
  httpEtag: '"recording-v1"',
  size: bytes.length,
  uploaded: new Date("2026-10-01T00:00:00Z"),
};

const bucket = (overrides: Partial<AudioBucket> = {}): AudioBucket => ({
  get: (key, options) => {
    expect(key).toBe(KEY);
    expect(options.onlyIf.etagMatches).toBe(metadata.etag);
    const body = options.range
      ? bytes.slice(
          options.range.offset,
          options.range.offset + options.range.length
        )
      : bytes;
    return Promise.resolve({ ...metadata, body: new Response(body).body });
  },
  head: () => Promise.resolve(metadata),
  ...overrides,
});

const fetchAudio = (
  headers: Record<string, string> = {},
  method = "GET",
  from = bucket()
) =>
  serveAudioObject(
    new Request(`https://example.com/${KEY}`, { headers, method }),
    KEY,
    from
  );

describe("serving audio", () => {
  test("serves the whole recording with cache and range headers", async () => {
    const response = await fetchAudio();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Length")).toBe("10");
    expect(response.headers.get("ETag")).toBe(metadata.httpEtag);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(await response.text()).toBe("0123456789");
  });

  test.each([
    ["bytes=0-1", "01", "bytes 0-1/10"],
    ["bytes=6-", "6789", "bytes 6-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=8-999", "89", "bytes 8-9/10"],
    ["bytes=-999", "0123456789", "bytes 0-9/10"],
  ])(
    "serves part of the recording for %s",
    async (range, body, contentRange) => {
      const response = await fetchAudio({ Range: range });
      expect(response.status).toBe(206);
      expect(response.headers.get("Content-Range")).toBe(contentRange);
      expect(response.headers.get("Content-Length")).toBe(String(body.length));
      expect(await response.text()).toBe(body);
    }
  );

  test.each(["bytes=10-", "bytes=5-3", "bytes=-0"])(
    "answers 416 for an impossible range: %s",
    async (range) => {
      const response = await fetchAudio({ Range: range });
      expect(response.status).toBe(416);
      expect(response.headers.get("Content-Range")).toBe("bytes */10");
      expect(await response.text()).toBe("");
    }
  );

  test.each([
    "nonsense",
    "bytes=-",
    "bytes=0-1,5-6",
    "bytes=9007199254740992-",
  ])(
    "serves the whole recording for a range it does not support: %s",
    async (range) => {
      const response = await fetchAudio({ Range: range });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("0123456789");
    }
  );

  test("answers HEAD without reading the recording", async () => {
    const response = await fetchAudio(
      { Range: "bytes=0-1" },
      "HEAD",
      bucket({
        get: () => {
          throw new Error("HEAD must not read the object");
        },
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe("10");
    expect(await response.text()).toBe("");
  });

  test.each([
    metadata.httpEtag,
    `W/${metadata.httpEtag}`,
    `"other", ${metadata.httpEtag}`,
    "*",
  ])("answers 304 when the browser has the recording: %s", async (etag) => {
    const response = await fetchAudio({ "If-None-Match": etag });
    expect(response.status).toBe(304);
    expect(response.headers.get("Content-Length")).toBeNull();
    expect(await response.text()).toBe("");
  });

  test.each([metadata.httpEtag, metadata.uploaded.toUTCString()])(
    "seeks when If-Range matches: %s",
    async (validator) => {
      const response = await fetchAudio({
        "If-Range": validator,
        Range: "bytes=1-2",
      });
      expect(response.status).toBe(206);
    }
  );

  test.each([
    '"old"',
    '"9999"',
    `W/${metadata.httpEtag}`,
    "Wed, 30 Sep 2026 00:00:00 GMT",
  ])(
    "sends the whole recording when If-Range is stale: %s",
    async (validator) => {
      const response = await fetchAudio({
        "If-Range": validator,
        Range: "bytes=1-2",
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("0123456789");
    }
  );

  test("answers 404 for a missing recording", async () => {
    const response = await fetchAudio(
      {},
      "GET",
      bucket({ head: () => Promise.resolve(null) })
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test.each([
    ["deleted", null],
    ["changed", metadata],
  ])(
    "never mixes bytes of a recording %s while serving it",
    async (_case, result) => {
      const response = await fetchAudio(
        {},
        "GET",
        bucket({ get: () => Promise.resolve(result) })
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  );

  test("rejects methods other than GET and HEAD", async () => {
    const response = await fetchAudio({}, "POST");
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
  });
});
