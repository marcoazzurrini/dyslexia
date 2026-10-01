import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  cachedAudio,
  generateChunk,
  makePlan,
  splitNarration,
} from "./narration.mjs";

const normalize = (text) => text.replaceAll(/\s+/gu, " ").trim();
const fixture =
  "A narrator reads an original sentence. Another sentence follows with useful context.\n\n".repeat(
    12
  );

const temporaryDirectory = async (context) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "dyslexia-narration-")
  );
  context.after(() => rm(directory, { force: true, recursive: true }));
  return directory;
};

const audioResponse = () =>
  new Response(Buffer.from("ID3test-audio"), {
    headers: { "content-type": "audio/mpeg", "request-id": "test-request" },
  });

test("chunking preserves every word and respects the limit", () => {
  const chunks = splitNarration(fixture, 180);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length > 0 && chunk.length <= 180));
  assert.equal(normalize(chunks.join(" ")), normalize(fixture));
});

test("chunking handles punctuation-free prose and CRLF", () => {
  const input = "数学 😀 a long paragraph without punctuation\r\n".repeat(20);
  const chunks = splitNarration(input, 100);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
  assert.equal(normalize(chunks.join(" ")), normalize(input));
});

test("empty input, invalid limits, and unsplittable tokens fail", () => {
  assert.throws(() => splitNarration("  "), /empty/u);
  for (const limit of [0, 99, 10_001, Number.NaN, 100.5]) {
    assert.throws(() => splitNarration(fixture, limit), /Chunk size/u);
  }
  assert.throws(() => splitNarration("a".repeat(200), 100), /unbroken/u);
});

test("cache identity includes voice, text, and order", () => {
  const first = makePlan(fixture, "voice-one", 180);
  assert.deepEqual(first, makePlan(fixture, "voice-one", 180));
  assert.notEqual(first.id, makePlan(fixture, "voice-two", 180).id);
  assert.notEqual(
    first.id,
    makePlan(`${fixture} An ending.`, "voice-one", 180).id
  );
  assert.equal(first.model, "eleven_v4");
  assert.equal(
    first.characters,
    first.chunks.reduce((sum, chunk) => sum + chunk.body.text.length, 0)
  );
});

test("completed chunks are reused without another paid request", async (context) => {
  const directory = await temporaryDirectory(context);
  const [chunk] = makePlan("Original test narration.", "voice").chunks;
  let calls = 0;
  const options = {
    apiKey: "test-key",
    directory,
    fetchAudio: (url, request) => {
      calls += 1;
      assert.match(
        url,
        /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/voice\?/u
      );
      assert.equal(request.headers["xi-api-key"], "test-key");
      assert.equal(JSON.parse(request.body).model_id, "eleven_v4");
      return audioResponse();
    },
    voiceId: "voice",
  };
  const filename = await generateChunk(chunk, options);
  assert.equal(await generateChunk(chunk, options), filename);
  assert.equal(calls, 1);
  assert.equal(await cachedAudio(chunk, directory), filename);
  const receipt = await readFile(
    path.join(directory, `${chunk.id}.json`),
    "utf-8"
  );
  assert.ok(!receipt.includes("test-key"));
});

test("an ambiguous network failure blocks automatic paid retries", async (context) => {
  const directory = await temporaryDirectory(context);
  const [chunk] = makePlan("A request that times out.", "voice").chunks;
  let calls = 0;
  const options = {
    apiKey: "test-key",
    directory,
    fetchAudio: () => {
      calls += 1;
      throw new Error("Network timeout");
    },
    voiceId: "voice",
  };
  await assert.rejects(generateChunk(chunk, options), /Network timeout/u);
  await assert.rejects(generateChunk(chunk, options), /Unconfirmed request/u);
  assert.equal(calls, 1);
});

test("HTTP failures do not log the response or retry", async (context) => {
  const directory = await temporaryDirectory(context);
  const [chunk] = makePlan("Original text.", "voice").chunks;
  const options = {
    apiKey: "test-key",
    directory,
    fetchAudio: () => new Response("secret response", { status: 429 }),
    voiceId: "voice",
  };
  await assert.rejects(generateChunk(chunk, options), /HTTP 429/u);
  await assert.rejects(generateChunk(chunk, options), /Unconfirmed request/u);
});

test("non-audio and empty responses are not accepted", async (context) => {
  const directory = await temporaryDirectory(context);
  const [first] = makePlan("Non-audio response.", "voice").chunks;
  const [second] = makePlan("Empty response.", "voice").chunks;
  await assert.rejects(
    generateChunk(first, {
      apiKey: "test-key",
      directory,
      fetchAudio: () => new Response("{}"),
      voiceId: "voice",
    }),
    /non-audio/u
  );
  await assert.rejects(
    generateChunk(second, {
      apiKey: "test-key",
      directory,
      fetchAudio: () =>
        new Response("", { headers: { "content-type": "audio/mpeg" } }),
      voiceId: "voice",
    }),
    /empty audio/u
  );
});

test("corrupt cached audio fails instead of silently billing again", async (context) => {
  const directory = await temporaryDirectory(context);
  const [chunk] = makePlan("Original narration.", "voice").chunks;
  const filename = await generateChunk(chunk, {
    apiKey: "test-key",
    directory,
    fetchAudio: audioResponse,
    voiceId: "voice",
  });
  await writeFile(filename, "damaged");
  await assert.rejects(cachedAudio(chunk, directory), /damaged/u);
});

test("the default CLI run is local and does not require an API key", async (context) => {
  const directory = await temporaryDirectory(context);
  const input = path.join(directory, "narration.txt");
  await writeFile(input, fixture);
  const script = new URL("narration.mjs", import.meta.url);
  const result = spawnSync(
    process.execPath,
    [script.pathname, "--input", input, "--rate-usd-per-1k", "0.08"],
    {
      cwd: directory,
      encoding: "utf-8",
      env: { PATH: process.env.PATH },
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run\. No API requests/u);
  assert.match(result.stdout, /Estimated generation cost/u);
});
