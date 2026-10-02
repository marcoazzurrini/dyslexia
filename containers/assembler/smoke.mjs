import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseDuration, runCommand } from "./assembly.mjs";
import { createAssemblyServer } from "./server.mjs";

export const smoke = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "assembler-smoke-"));
  const token = "local-smoke-capability";
  const jobId = "12345678-1234-4234-8234-123456789abc";
  const prefix = `/api/pipeline/internal/jobs/${jobId}`;
  const downloads = [];
  let uploaded;
  let uploadHeaders;
  const fixtures = [];
  const artifactServer = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end();
      return;
    }
    const index = [`${prefix}/chunks/0`, `${prefix}/chunks/1`].indexOf(
      request.url
    );
    if (request.method === "GET" && index !== -1) {
      downloads.push(index);
      response.writeHead(200, { "Content-Type": "audio/mpeg" });
      response.end(fixtures[index]);
      return;
    }
    if (request.method === "PUT" && request.url === `${prefix}/audio`) {
      const buffers = [];
      for await (const chunk of request) {
        buffers.push(chunk);
      }
      uploaded = Buffer.concat(buffers);
      uploadHeaders = request.headers;
      response.writeHead(204).end();
      return;
    }
    response.writeHead(404).end();
  });
  const assemblerServer = createAssemblyServer({ allowLocal: true });
  try {
    for (const index of [0, 1]) {
      const filename = `fixture-${index}.mp3`;
      // eslint-disable-next-line no-await-in-loop -- Generate one fixture at a time to bound ffmpeg resource use.
      await runCommand(
        "ffmpeg",
        [
          "-nostdin",
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          `sine=frequency=${440 + index * 220}:duration=0.25`,
          "-ar",
          "44100",
          "-ac",
          "1",
          "-c:a",
          "libmp3lame",
          filename,
        ],
        { cwd: directory }
      );
      // eslint-disable-next-line no-await-in-loop -- Read each completed fixture before starting the next process.
      fixtures.push(await readFile(path.join(directory, filename)));
    }
    artifactServer.listen(0, "127.0.0.1");
    await once(artifactServer, "listening");
    assemblerServer.listen(0, "127.0.0.1");
    await once(assemblerServer, "listening");
    const response = await fetch(
      `http://127.0.0.1:${assemblerServer.address().port}/assemble`,
      {
        body: JSON.stringify({
          baseUrl: `http://127.0.0.1:${artifactServer.address().port}`,
          chunkCount: 2,
          jobId,
          token,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(30_000),
      }
    );
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.deepEqual(downloads, [0, 1]);
    assert.equal(result.bytes, uploaded.length);
    assert.equal(uploadHeaders["content-length"], String(uploaded.length));
    assert.equal(uploadHeaders["content-type"], "audio/mpeg");
    await writeFile(path.join(directory, "uploaded.mp3"), uploaded);
    const actual = parseDuration(
      await runCommand(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          "uploaded.mp3",
        ],
        { cwd: directory }
      )
    );
    assert.equal(result.durationSeconds, actual);
    assert.ok(actual >= 0.5 && actual < 0.8);
    process.stdout.write(
      `Assembly smoke passed: ${result.bytes} bytes, ${actual}s\n`
    );
  } finally {
    await Promise.all(
      [assemblerServer, artifactServer].map((server) => {
        const { promise, resolve } = Promise.withResolvers();
        server.closeAllConnections();
        server.close(resolve);
        return promise;
      })
    );
    await rm(directory, { force: true, recursive: true });
  }
};

if (import.meta.main) {
  await smoke();
}
