import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import test from "node:test";

import {
  assemble,
  AssemblyError,
  assemblyPlan,
  COMMAND_TIMEOUT_MS,
  createByteLimiter,
  MAX_BODY_BYTES,
  MAX_CHUNK_BYTES,
  MAX_TOTAL_BYTES,
  parseDuration,
  REQUEST_TIMEOUT_MS,
  runCommand,
  validateAssembleInput,
  validateBaseUrl,
} from "./assembly.mjs";
import { createAssemblyServer } from "./server.mjs";

const command = {
  baseUrl: "https://dyslexia.marcoazzurrini.com",
  chunkCount: 2,
  jobId: "12345678-1234-4234-8234-123456789abc",
  token: "scoped-job-token",
};
const errorCode = (code) => (error) =>
  error instanceof AssemblyError && error.code === code;

const temporaryRoot = async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "assembler-test-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  return root;
};

const listen = async (t, server) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    const { promise, resolve } = Promise.withResolvers();
    server.closeAllConnections();
    server.close(resolve);
    await promise;
  });
  return `http://127.0.0.1:${server.address().port}`;
};

const post = (baseUrl, input = command, options = {}) =>
  fetch(`${baseUrl}/assemble`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    ...options,
  });

const harness = async (t, overrides = {}) => {
  const tempRoot = await temporaryRoot(t);
  const calls = [];
  const directories = [];
  let uploaded;
  const fetchImpl = async (url, options) => {
    calls.push({ options, url });
    assert.equal(options.headers.Authorization, `Bearer ${command.token}`);
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    options.signal.throwIfAborted();
    if (options.method === "GET") {
      const index = Number(url.split("/").at(-1));
      return new Response(`audio-${index}`);
    }
    assert.equal(options.method, "PUT");
    const buffers = [];
    for await (const chunk of options.body) {
      buffers.push(chunk);
    }
    uploaded = Buffer.concat(buffers);
    assert.equal(options.headers["Content-Length"], String(uploaded.length));
    assert.equal(options.headers["Content-Type"], "audio/mpeg");
    return new Response(null, { status: 204 });
  };
  const commandRunner = async (executable, args, options) => {
    assert.equal(options.timeoutMs, COMMAND_TIMEOUT_MS);
    assert.ok(options.signal instanceof AbortSignal);
    directories.push(options.cwd);
    const plan = assemblyPlan(command.chunkCount);
    if (executable === "ffmpeg") {
      assert.deepEqual(args, plan.ffmpegArgs);
      assert.equal(
        await readFile(path.join(options.cwd, "concat.txt"), "utf-8"),
        plan.concat
      );
      const buffers = await Promise.all(
        plan.chunks.map((filename) =>
          readFile(path.join(options.cwd, filename))
        )
      );
      await writeFile(
        path.join(options.cwd, "assembled.mp3"),
        Buffer.concat(buffers)
      );
      return "";
    }
    assert.equal(executable, "ffprobe");
    assert.deepEqual(args, plan.ffprobeArgs);
    return '{"format":{"duration":"1.234"}}';
  };
  return {
    calls,
    directories,
    options: { commandRunner, fetchImpl, tempRoot, ...overrides },
    tempRoot,
    uploaded: () => uploaded,
  };
};

const limitBytes = async (buffers, budget) => {
  await pipeline(
    Readable.from(buffers),
    createByteLimiter(budget),
    new Writable({
      /* eslint-disable promise/prefer-await-to-callbacks -- The fake Writable must acknowledge each write through Node's callback contract. */
      write(_chunk, _encoding, callback) {
        callback();
      },
      /* eslint-enable promise/prefer-await-to-callbacks */
    })
  );
};

test("validates the contract and fixed public origins", () => {
  assert.deepEqual(validateAssembleInput(command), command);
  assert.equal(validateBaseUrl(`${command.baseUrl}/`), command.baseUrl);
  assert.equal(
    validateBaseUrl("https://dyslexia.marco-azzurrini-art.workers.dev"),
    "https://dyslexia.marco-azzurrini-art.workers.dev"
  );
  for (const chunkCount of [1, 40]) {
    assert.equal(
      validateAssembleInput({ ...command, chunkCount }).chunkCount,
      chunkCount
    );
  }
  assert.equal(MAX_CHUNK_BYTES, 8_388_608);
  assert.equal(MAX_TOTAL_BYTES, 134_217_728);
  assert.equal(MAX_BODY_BYTES, 4096);
  assert.equal(REQUEST_TIMEOUT_MS, 300_000);
  assert.equal(COMMAND_TIMEOUT_MS, 60_000);
});

test("rejects invalid UUIDs, counts, tokens, shapes and extra properties", () => {
  const invalid = [
    null,
    [],
    {},
    { ...command, extra: true },
    ...[
      "../file",
      "uuid",
      "12345678-1234-4234-1234-123456789abc",
      `${command.jobId}/x`,
    ].map((jobId) => ({ ...command, jobId })),
    ...[0, -1, 41, 1.5, Number.NaN, Infinity, "2", null].map((chunkCount) => ({
      ...command,
      chunkCount,
    })),
    ...["", "with space", "token\r\nHeader:x", "x".repeat(2049), null, "é"].map(
      (token) => ({ ...command, token })
    ),
  ];
  for (const input of invalid) {
    assert.throws(
      () => validateAssembleInput(input),
      errorCode("invalid_input")
    );
  }
});

test("rejects SSRF origins, URL normalization tricks and local mode by default", () => {
  const invalid = [
    "http://dyslexia.marcoazzurrini.com",
    "https://example.com",
    "https://dyslexia.marcoazzurrini.com.evil.test",
    "https://evil.dyslexia.marcoazzurrini.com",
    "https://dyslexia.marcoazzurrini.com@evil.test",
    "https://user:pass@dyslexia.marcoazzurrini.com",
    "https://@dyslexia.marcoazzurrini.com",
    "https://dyslexia.marcoazzurrini.com:8443",
    "https://dyslexia.marcoazzurrini.com/path",
    "https://dyslexia.marcoazzurrini.com/..",
    "https://dyslexia.marcoazzurrini.com?",
    "https://dyslexia.marcoazzurrini.com#",
    "https://dyslexia.marcoazzurrini.com?x=1",
    "https://dyslexia.marcoazzurrini.com#x",
    "https://dyslexia.marcoazzurrini.com\\@evil.test",
    "https://dyslexia.marcoazzurrini.com.",
    " https://dyslexia.marcoazzurrini.com",
    "https://dyslexia.marcoazzurrini.com\n",
    "file:///tmp/audio.mp3",
    "http://localhost",
    "http://127.0.0.1:3000",
    "http://host.docker.internal:3000",
    "http://169.254.169.254",
    "http://[::1]",
    "http://127.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://0177.0.0.1",
  ];
  for (const baseUrl of invalid) {
    assert.throws(
      () => validateBaseUrl(baseUrl),
      errorCode("invalid_base_url"),
      baseUrl
    );
  }
});

test("local mode allows only explicit HTTP loopback names, never arbitrary hosts", () => {
  for (const hostname of ["localhost", "127.0.0.1", "host.docker.internal"]) {
    for (const suffix of ["", ":3000", ":65535/"]) {
      const origin = `http://${hostname}${suffix}`;
      assert.equal(validateBaseUrl(origin, true), new URL(origin).origin);
    }
    assert.throws(() => validateBaseUrl(`https://${hostname}`, true));
    assert.throws(() => validateBaseUrl(`http://${hostname}`, "true"));
  }
  for (const url of [
    "http://127.1",
    "http://2130706433",
    "http://localhost:65536",
    "http://localhost:0",
    "http://localhost.evil.test",
    "http://192.168.1.2",
    "http://[::1]",
  ]) {
    assert.throws(() => validateBaseUrl(url, true));
  }
});

test("creates ordered, fixed filenames and concat stream-copy arguments", () => {
  const plan = assemblyPlan(40);
  assert.equal(plan.chunks.length, 40);
  assert.deepEqual(plan.chunks.slice(9, 12), [
    "chunk-9.mp3",
    "chunk-10.mp3",
    "chunk-11.mp3",
  ]);
  assert.equal(plan.concat.split("\n")[39], "file 'chunk-39.mp3'");
  for (const pair of [
    ["-f", "concat"],
    ["-safe", "1"],
    ["-c:a", "copy"],
    ["-protocol_whitelist", "file"],
    ["-format_whitelist", "concat,mp3"],
  ]) {
    assert.equal(
      plan.ffmpegArgs[plan.ffmpegArgs.indexOf(pair[0]) + 1],
      pair[1]
    );
  }
  for (const count of [0, 41, 1.1, "2"]) {
    assert.throws(() => assemblyPlan(count));
  }
});

test("rejects missing, zero, negative and non-finite probed durations", () => {
  assert.equal(parseDuration('{"format":{"duration":"2.345"}}'), 2.345);
  for (const value of [
    "N/A",
    "NaN",
    "Infinity",
    "-1",
    "0",
    "",
    " ",
    "1e999",
    null,
    true,
    1,
  ]) {
    assert.throws(
      () => parseDuration(JSON.stringify({ format: { duration: value } })),
      errorCode("invalid_audio_duration")
    );
  }
  for (const value of ["not json", "{}", "null"]) {
    assert.throws(
      () => parseDuration(value),
      errorCode("invalid_audio_duration")
    );
  }
});

test("enforces actual per-chunk and aggregate byte caps at exact boundaries", async () => {
  const block = Buffer.alloc(MAX_CHUNK_BYTES);
  const budget = { bytes: 0 };
  for (let index = 0; index < 16; index += 1) {
    // eslint-disable-next-line no-await-in-loop -- Exercise sequential streams against one shared aggregate byte budget.
    await limitBytes([block], budget);
  }
  assert.equal(budget.bytes, MAX_TOTAL_BYTES);
  await assert.rejects(
    limitBytes([Buffer.alloc(1)], budget),
    errorCode("download_too_large")
  );
  await assert.rejects(
    limitBytes([block, Buffer.alloc(1)], { bytes: 0 }),
    errorCode("download_too_large")
  );
});

test("assembles sequentially, uploads authenticated bytes, cleans up, and permits safe retries", async (t) => {
  const fixture = await harness(t);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop -- A retry must begin only after the previous streaming assembly and cleanup finish.
    const result = await assemble(command, fixture.options);
    assert.deepEqual(result, {
      bytes: 14,
      durationSeconds: 1.234,
    });
    assert.equal(fixture.uploaded().toString(), "audio-0audio-1");
    // eslint-disable-next-line no-await-in-loop -- Verify cleanup before the next sequential retry.
    const remaining = await readdir(fixture.tempRoot);
    assert.deepEqual(remaining, []);
  }
  assert.notEqual(fixture.directories[0], fixture.directories[2]);
  const prefix = `${command.baseUrl}/api/pipeline/internal/jobs/${command.jobId}`;
  assert.deepEqual(
    fixture.calls.map(({ url }) => url),
    [
      `${prefix}/chunks/0`,
      `${prefix}/chunks/1`,
      `${prefix}/audio`,
      `${prefix}/chunks/0`,
      `${prefix}/chunks/1`,
      `${prefix}/audio`,
    ]
  );
});

test("invalid input creates no temporary directory or network request", async (t) => {
  const fixture = await harness(t);
  await assert.rejects(
    assemble({ ...command, chunkCount: 0 }, fixture.options),
    errorCode("invalid_input")
  );
  assert.deepEqual(fixture.calls, []);
  assert.deepEqual(await readdir(fixture.tempRoot), []);
});

for (const scenario of [
  "http",
  "empty",
  "declared-size",
  "actual-size",
  "stream-error",
]) {
  test(`cleans partial downloads after ${scenario} failure`, async (t) => {
    let called = 0;
    const fixture = await harness(t, {
      fetchImpl: () => {
        called += 1;
        if (scenario === "http") {
          return Promise.resolve(
            new Response("secret upstream details", { status: 401 })
          );
        }
        if (scenario === "empty") {
          return Promise.resolve(new Response(""));
        }
        if (scenario === "declared-size") {
          return Promise.resolve(
            new Response("x", {
              headers: { "Content-Length": String(MAX_CHUNK_BYTES + 1) },
            })
          );
        }
        if (scenario === "stream-error") {
          return Promise.resolve(
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new Uint8Array([1]));
                  controller.error(new Error("secret stream failure"));
                },
              })
            )
          );
        }
        return Promise.resolve(
          new Response(Buffer.alloc(MAX_CHUNK_BYTES + 1), {
            headers: { "Content-Length": "1" },
          })
        );
      },
    });
    await assert.rejects(assemble(command, fixture.options));
    assert.equal(called, 1);
    assert.deepEqual(fixture.directories, []);
    assert.deepEqual(await readdir(fixture.tempRoot), []);
  });
}

for (const scenario of ["ffmpeg", "ffprobe", "duration", "upload"]) {
  test(`cleans up after ${scenario} failure without retrying`, async (t) => {
    const fixture = await harness(t);
    const { commandRunner, fetchImpl } = fixture.options;
    fixture.options.commandRunner = (name, args, options) => {
      if (name === scenario) {
        return Promise.reject(new AssemblyError("command_failed"));
      }
      if (scenario === "duration" && name === "ffprobe") {
        return Promise.resolve('{"format":{"duration":"N/A"}}');
      }
      return commandRunner(name, args, options);
    };
    fixture.options.fetchImpl = (url, options) => {
      if (scenario === "upload" && options.method === "PUT") {
        return Promise.resolve(new Response("no", { status: 500 }));
      }
      return fetchImpl(url, options);
    };
    await assert.rejects(assemble(command, fixture.options));
    assert.deepEqual(await readdir(fixture.tempRoot), []);
    assert.equal(
      fixture.calls.filter(({ options }) => options.method === "GET").length,
      2
    );
  });
}

test("cancellation waits for in-flight I/O before removing the scoped directory", async (t) => {
  const started = Promise.withResolvers();
  const stopped = Promise.withResolvers();
  const release = Promise.withResolvers();
  let directory;
  const fixture = await harness(t, {
    commandRunner: async (_name, _args, options) => {
      directory = options.cwd;
      started.resolve();
      options.signal.addEventListener("abort", () => stopped.resolve(), {
        once: true,
      });
      await release.promise;
      options.signal.throwIfAborted();
    },
  });
  const controller = new AbortController();
  const pending = assemble(command, {
    ...fixture.options,
    signal: controller.signal,
  });
  const rejected = assert.rejects(pending);
  await started.promise;
  controller.abort();
  await stopped.promise;
  const remaining = await readdir(directory);
  assert.ok(remaining.includes("chunk-0.mp3"));
  release.resolve();
  await rejected;
  assert.deepEqual(await readdir(fixture.tempRoot), []);
});

for (const phase of ["download", "upload"]) {
  test(`never follows ${phase} redirects or leaks bearer tokens to redirect targets`, async (t) => {
    let redirected = 0;
    const sink = await listen(
      t,
      createServer((_request, response) => {
        redirected += 1;
        response.end("unexpected");
      })
    );
    const paths = [];
    const source = await listen(
      t,
      createServer((request, response) => {
        paths.push(request.url);
        assert.equal(request.headers.authorization, `Bearer ${command.token}`);
        if (phase === "download" || request.method === "PUT") {
          request.resume();
          response.writeHead(307, { Location: `${sink}/capture` }).end();
        } else {
          response.end("audio");
        }
      })
    );
    const fixture = await harness(t, { allowLocal: true, fetchImpl: fetch });
    await assert.rejects(
      assemble({ ...command, baseUrl: source }, fixture.options)
    );
    assert.equal(redirected, 0);
    assert.equal(paths.length, phase === "download" ? 1 : 3);
    assert.deepEqual(await readdir(fixture.tempRoot), []);
  });
}

test("command runner enforces timeout, output cap, spawn and exit errors without a shell", async () => {
  assert.equal(
    await runCommand(process.execPath, [
      "-e",
      "process.stdout.write(process.argv[1])",
      "$(echo unsafe);x",
    ]),
    "$(echo unsafe);x"
  );
  await assert.rejects(
    runCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      timeoutMs: 20,
    }),
    errorCode("command_timeout")
  );
  await assert.rejects(
    runCommand(process.execPath, [
      "-e",
      "process.stdout.write('x'.repeat(70000))",
    ]),
    errorCode("command_output_too_large")
  );
  await assert.rejects(
    runCommand(process.execPath, ["-e", "process.exit(2)"]),
    errorCode("command_failed")
  );
  await assert.rejects(
    runCommand("/nonexistent/assembler-test-command", []),
    errorCode("command_failed")
  );
  const controller = new AbortController();
  const pending = runCommand(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    { signal: controller.signal }
  );
  controller.abort();
  await assert.rejects(pending, errorCode("request_aborted"));
});

test("HTTP health, routing, media type, malformed JSON and fixed error responses", async (t) => {
  const baseUrl = await listen(t, createAssemblyServer());
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  const wrongMethod = await fetch(`${baseUrl}/assemble`);
  assert.equal(wrongMethod.status, 405);
  const notFound = await post(`${baseUrl}/unknown`);
  assert.equal(notFound.status, 404);
  const wrongMediaType = await post(baseUrl, command, {
    headers: { "Content-Type": "text/plain" },
  });
  assert.equal(wrongMediaType.status, 415);
  const malformed = await post(baseUrl, command, { body: "{" });
  assert.equal(malformed.status, 400);
  const response = await post(baseUrl, {
    ...command,
    token: "secret\r\ninjected",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_input" });
  const localOrigin = await post(baseUrl, {
    ...command,
    baseUrl: "http://127.0.0.1",
  });
  assert.equal(localOrigin.status, 400);
});

test("HTTP body cap rejects declared and streamed oversized bodies", async (t) => {
  const baseUrl = await listen(t, createAssemblyServer());
  const oversized = await post(baseUrl, command, {
    body: "x".repeat(MAX_BODY_BYTES + 1),
  });
  assert.equal(oversized.status, 413);
  const { promise, resolve, reject } = Promise.withResolvers();
  const request = httpRequest(
    `${baseUrl}/assemble`,
    {
      headers: {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      },
      method: "POST",
    },
    (response) => {
      response.resume();
      resolve(response.statusCode);
    }
  );
  request.on("error", reject);
  request.write("x".repeat(2048));
  request.end("x".repeat(2049));
  const status = await promise;
  assert.equal(status, 413);
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
});

test("HTTP handles only one job, keeps health live, and unlocks after completion", async (t) => {
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  let calls = 0;
  const baseUrl = await listen(
    t,
    createAssemblyServer({
      assembleJob: async (_input, options) => {
        assert.equal(options.allowLocal, false);
        calls += 1;
        started.resolve();
        await release.promise;
        return { bytes: 14, durationSeconds: 1.234 };
      },
    })
  );
  const pending = post(baseUrl);
  await started.promise;
  const busy = await post(baseUrl);
  assert.equal(busy.status, 409);
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal(calls, 1);
  release.resolve();
  const response = await pending;
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    bytes: 14,
    durationSeconds: 1.234,
  });
  const retry = await post(baseUrl);
  assert.equal(retry.status, 200);
  assert.equal(calls, 2);
});

test("overall HTTP timeout aborts work and frees the lock after cleanup", async (t) => {
  let aborted = false;
  const baseUrl = await listen(
    t,
    createAssemblyServer({
      assembleJob: (_input, { signal }) => {
        const { promise, reject } = Promise.withResolvers();
        signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(signal.reason);
          },
          { once: true }
        );
        return promise;
      },
      requestTimeoutMs: 30,
    })
  );
  const response = await post(baseUrl);
  assert.equal(response.status, 504);
  assert.equal(aborted, true);
  assert.deepEqual(await response.json(), { error: "request_timeout" });
  const malformed = await post(baseUrl, {}, { body: "{" });
  assert.equal(malformed.status, 400);
});

test("overall HTTP timeout covers a stalled request body", async (t) => {
  const baseUrl = await listen(
    t,
    createAssemblyServer({ requestTimeoutMs: 30 })
  );
  const { promise, resolve, reject } = Promise.withResolvers();
  const request = httpRequest(
    `${baseUrl}/assemble`,
    {
      headers: {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      },
      method: "POST",
    },
    (response) => {
      response.resume();
      resolve(response.statusCode);
      request.end();
    }
  );
  request.on("error", reject);
  request.write("{");
  const status = await promise;
  assert.equal(status, 504);
});
