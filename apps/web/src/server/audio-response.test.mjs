import assert from "node:assert/strict";
import test from "node:test";

import { serveAudio } from "./audio-response.ts";

const filename = "conway-b2ac2e01fb55c21c.mp3";
const bytes = new TextEncoder().encode("0123456789");
const metadata = {
  etag: "recording-v1",
  httpEtag: '"recording-v1"',
  size: bytes.length,
  uploaded: new Date("2026-10-01T00:00:00Z"),
};
const makeBucket = () => ({
  get: (key, options) => {
    assert.equal(key, filename);
    assert.equal(options.onlyIf.etagMatches, metadata.etag);
    const range = options?.range;
    const body = range
      ? bytes.slice(range.offset, range.offset + range.length)
      : bytes;
    return Promise.resolve({ ...metadata, body: new Response(body).body });
  },
  head: () => Promise.resolve(metadata),
});
const fetchAudio = (headers = {}, method = "GET", bucket = makeBucket()) =>
  serveAudio(
    new Request(`https://example.com/audio/${filename}`, { headers, method }),
    filename,
    bucket
  );

test("serves full audio with byte-range and cache metadata", async () => {
  const response = await fetchAudio();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "audio/mpeg");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(response.headers.get("Content-Length"), "10");
  assert.equal(response.headers.get("ETag"), metadata.httpEtag);
  assert.equal(response.headers.get("Cache-Control"), "private, max-age=3600");
  assert.equal(await response.text(), "0123456789");
});

for (const [range, expected, contentRange] of [
  ["bytes=0-1", "01", "bytes 0-1/10"],
  ["bytes=6-", "6789", "bytes 6-9/10"],
  ["bytes=-3", "789", "bytes 7-9/10"],
  ["bytes=8-999", "89", "bytes 8-9/10"],
  ["bytes=-999", "0123456789", "bytes 0-9/10"],
]) {
  test(`partial audio: ${range}`, async () => {
    const response = await fetchAudio({ Range: range });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("Content-Range"), contentRange);
    assert.equal(
      response.headers.get("Content-Length"),
      String(expected.length)
    );
    assert.equal(await response.text(), expected);
  });
}

for (const range of ["bytes=10-", "bytes=5-3", "bytes=-0"]) {
  test(`unsatisfiable range returns 416: ${range}`, async () => {
    const response = await fetchAudio({ Range: range });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("Content-Range"), "bytes */10");
    assert.equal(await response.text(), "");
  });
}

for (const range of [
  "nonsense",
  "bytes=-",
  "bytes=0-1,5-6",
  "bytes=9007199254740992-",
]) {
  test(`unsupported range falls back to full audio: ${range}`, async () => {
    const response = await fetchAudio({ Range: range });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "0123456789");
  });
}

test("HEAD does not fetch bytes and ignores Range", async () => {
  const response = await fetchAudio({ Range: "bytes=0-1" }, "HEAD", {
    get: () => {
      throw new Error("HEAD must not read the object");
    },
    head: () => Promise.resolve(metadata),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Length"), "10");
  assert.equal(await response.text(), "");
});

for (const etag of [
  metadata.httpEtag,
  `W/${metadata.httpEtag}`,
  `"other", ${metadata.httpEtag}`,
  "*",
]) {
  test(`conditional audio returns 304: ${etag}`, async () => {
    const response = await fetchAudio({ "If-None-Match": etag });
    assert.equal(response.status, 304);
    assert.equal(response.headers.get("Content-Length"), null);
    assert.equal(await response.text(), "");
  });
}

for (const validator of [metadata.httpEtag, metadata.uploaded.toUTCString()]) {
  test(`current If-Range permits seeking: ${validator}`, async () => {
    const response = await fetchAudio({
      "If-Range": validator,
      Range: "bytes=1-2",
    });
    assert.equal(response.status, 206);
  });
}
for (const validator of [
  '"old"',
  '"9999"',
  `W/${metadata.httpEtag}`,
  "Wed, 30 Sep 2026 00:00:00 GMT",
]) {
  test(`stale If-Range sends full audio: ${validator}`, async () => {
    const response = await fetchAudio({
      "If-Range": validator,
      Range: "bytes=1-2",
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "0123456789");
  });
}

test("unknown keys and missing objects return 404, not the app HTML", async () => {
  const unknown = await serveAudio(
    new Request("https://example.com/audio/unknown.mp3"),
    "unknown.mp3",
    makeBucket()
  );
  assert.equal(unknown.status, 404);
  const missing = await fetchAudio({}, "GET", {
    ...makeBucket(),
    head: () => Promise.resolve(null),
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("Cache-Control"), "no-store");
});

for (const result of [null, metadata]) {
  test(`changed or deleted objects cannot return mismatched bytes: ${result === null ? "deleted" : "changed"}`, async () => {
    const response = await fetchAudio({}, "GET", {
      ...makeBucket(),
      get: () => Promise.resolve(result),
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });
}

test("methods other than GET and HEAD are rejected", async () => {
  const response = await fetchAudio({}, "POST");
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});
