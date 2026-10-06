import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { Effect, Schema } from "effect";

export const MAX_CHUNKS = 40;
export const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
export const MAX_BODY_BYTES = 4 * 1024;
export const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
export const COMMAND_TIMEOUT_MS = 60 * 1000;
const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024;
const PUBLIC_HOSTS = new Set([
  "dyslexia.marcoazzurrini.com",
  "dyslexia.marco-azzurrini-art.workers.dev",
]);
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "host.docker.internal"]);
const UUID =
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;
const BEARER_TOKEN = /^[\w.~+/-]+=*$/u;
const COMMAND_SCHEMA = Schema.Struct({
  baseUrl: Schema.String,
  chunkCount: Schema.Number,
  jobId: Schema.String,
  token: Schema.String,
});
const DURATION_SCHEMA = Schema.Struct({
  format: Schema.Struct({ duration: Schema.String }),
});

export class AssemblyError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.name = "AssemblyError";
    this.code = code;
    this.status = status;
  }
}

export const validateBaseUrl = (baseUrl, allowLocal = false) => {
  // Compare the raw authority too: URL normalizes numeric IPs and dot segments.
  const match =
    /^(?<protocol>https?):\/\/(?<hostname>[a-z\d.-]+)(?::(?<port>[1-9]\d{0,4}))?\/?$/u.exec(
      baseUrl
    );
  if (!match) {
    throw new AssemblyError("invalid_base_url", 400);
  }
  const { protocol, hostname, port } = match.groups;
  const publicOrigin =
    protocol === "https" && PUBLIC_HOSTS.has(hostname) && !port;
  const localOrigin =
    allowLocal === true && protocol === "http" && LOCAL_HOSTS.has(hostname);
  if (!(publicOrigin || localOrigin) || (port && Number(port) > 65_535)) {
    throw new AssemblyError("invalid_base_url", 400);
  }
  return new URL(baseUrl).origin;
};

export const validateAssembleInput = (input, { allowLocal = false } = {}) => {
  let command;
  try {
    command = Schema.decodeUnknownSync(COMMAND_SCHEMA, {
      onExcessProperty: "error",
    })(input);
  } catch {
    throw new AssemblyError("invalid_input", 400);
  }
  if (
    !UUID.test(command.jobId) ||
    !Number.isInteger(command.chunkCount) ||
    command.chunkCount < 1 ||
    command.chunkCount > MAX_CHUNKS ||
    command.token.length < 1 ||
    command.token.length > 2048 ||
    !BEARER_TOKEN.test(command.token)
  ) {
    throw new AssemblyError("invalid_input", 400);
  }
  return {
    ...command,
    baseUrl: validateBaseUrl(command.baseUrl, allowLocal),
  };
};

export const createByteLimiter = (budget) => {
  let bytes = 0;
  return new Transform({
    /* eslint-disable promise/prefer-await-to-callbacks -- Node Transform requires its callback for backpressure and errors. */
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      budget.bytes += chunk.length;
      if (bytes > MAX_CHUNK_BYTES || budget.bytes > MAX_TOTAL_BYTES) {
        callback(new AssemblyError("download_too_large", 413));
        return;
      }
      callback(null, chunk);
    },
    /* eslint-enable promise/prefer-await-to-callbacks */
  });
};

export const downloadChunk = async (
  url,
  destination,
  { token, signal, budget, fetchImpl = fetch }
) => {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
    method: "GET",
    redirect: "error",
    signal,
  });
  try {
    if (response.status !== 200 || !response.body) {
      throw new AssemblyError("chunk_download_failed");
    }
    const length = response.headers.get("content-length");
    if (
      length !== null &&
      (!/^\d+$/u.test(length) ||
        Number(length) > MAX_CHUNK_BYTES ||
        Number(length) + budget.bytes > MAX_TOTAL_BYTES)
    ) {
      throw new AssemblyError("download_too_large", 413);
    }
    const before = budget.bytes;
    await pipeline(
      Readable.fromWeb(response.body),
      createByteLimiter(budget),
      createWriteStream(destination, { flags: "wx", mode: 0o600 }),
      { signal }
    );
    if (budget.bytes === before) {
      throw new AssemblyError("empty_chunk");
    }
  } finally {
    if (response.body && !response.body.locked) {
      await response.body.cancel();
    }
  }
};

export const runCommand = (
  command,
  args,
  { cwd, signal, timeoutMs = COMMAND_TIMEOUT_MS } = {}
) => {
  signal?.throwIfAborted();
  let child;
  try {
    child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    return Promise.reject(error);
  }
  const { promise, resolve, reject } = Promise.withResolvers();
  let failure;
  let stdout = "";
  let outputBytes = 0;
  const stop = (error) => {
    failure ??= error;
    child.kill("SIGKILL");
  };
  const abort = () => stop(new AssemblyError("request_aborted", 408));
  const timer = setTimeout(
    () => stop(new AssemblyError("command_timeout", 504)),
    timeoutMs
  );
  signal?.addEventListener("abort", abort, { once: true });
  // The child is always reaped before rejecting, including cancellation.
  child.on("error", () => {
    failure ??= new AssemblyError("command_failed");
  });
  const consume = (chunk, capture) => {
    outputBytes += chunk.length;
    if (outputBytes > MAX_COMMAND_OUTPUT_BYTES) {
      stop(new AssemblyError("command_output_too_large"));
    } else if (capture) {
      stdout += chunk.toString("utf-8");
    }
  };
  child.stdout.on("data", (chunk) => consume(chunk, true));
  child.stderr.on("data", (chunk) => consume(chunk, false));
  child.once("close", (code) => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    if (failure || code !== 0) {
      reject(failure ?? new AssemblyError("command_failed"));
    } else {
      resolve(stdout);
    }
  });
  return promise;
};

export const assemblyPlan = (chunkCount) => {
  if (
    !Number.isInteger(chunkCount) ||
    chunkCount < 1 ||
    chunkCount > MAX_CHUNKS
  ) {
    throw new AssemblyError("invalid_chunk_count", 400);
  }
  const chunks = Array.from(
    { length: chunkCount },
    (_, index) => `chunk-${index}.mp3`
  );
  return {
    chunks,
    concat: `${chunks.map((filename) => `file '${filename}'`).join("\n")}\n`,
    ffmpegArgs: [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-n",
      "-protocol_whitelist",
      "file",
      "-format_whitelist",
      "concat,mp3",
      "-f",
      "concat",
      "-safe",
      "1",
      "-i",
      "concat.txt",
      "-map",
      "0:a:0",
      "-c:a",
      "copy",
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",
      "-f",
      "mp3",
      "assembled.mp3",
    ],
    ffprobeArgs: [
      "-v",
      "error",
      "-protocol_whitelist",
      "file",
      "-f",
      "mp3",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      "assembled.mp3",
    ],
  };
};

export const parseDuration = (stdout) => {
  let duration;
  try {
    const parsed = Schema.decodeUnknownSync(DURATION_SCHEMA)(
      JSON.parse(stdout)
    );
    const value = parsed.format.duration;
    if (/^\d+(?:\.\d+)?$/u.test(value)) {
      duration = Number(value);
    }
  } catch {
    throw new AssemblyError("invalid_audio_duration");
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new AssemblyError("invalid_audio_duration");
  }
  return duration;
};

export const uploadAudio = async (
  url,
  audioPath,
  { token, bytes, signal, fetchImpl = fetch }
) => {
  const body = createReadStream(audioPath);
  try {
    const response = await fetchImpl(url, {
      body,
      duplex: "half",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Length": String(bytes),
        "Content-Type": "audio/mpeg",
      },
      method: "PUT",
      redirect: "error",
      signal,
    });
    await response.body?.cancel();
    if (!response.ok) {
      throw new AssemblyError("audio_upload_failed");
    }
  } finally {
    body.destroy();
  }
};

export const assembleInDirectory = async (
  command,
  directory,
  { signal, fetchImpl = fetch, commandRunner = runCommand } = {}
) => {
  const plan = assemblyPlan(command.chunkCount);
  const jobUrl = `${command.baseUrl}/api/pipeline/internal/jobs/${command.jobId}`;
  const budget = { bytes: 0 };
  for (const [index, filename] of plan.chunks.entries()) {
    signal?.throwIfAborted();
    // eslint-disable-next-line no-await-in-loop -- Stream one bounded chunk at a time against the shared byte budget.
    await downloadChunk(
      `${jobUrl}/chunks/${index}`,
      path.join(directory, filename),
      {
        budget,
        fetchImpl,
        signal,
        token: command.token,
      }
    );
  }
  await writeFile(path.join(directory, "concat.txt"), plan.concat, {
    flag: "wx",
    mode: 0o600,
  });
  const options = { cwd: directory, signal, timeoutMs: COMMAND_TIMEOUT_MS };
  await commandRunner("ffmpeg", plan.ffmpegArgs, options);
  const durationSeconds = parseDuration(
    await commandRunner("ffprobe", plan.ffprobeArgs, options)
  );
  const audioPath = path.join(directory, "assembled.mp3");
  const { size: bytes } = await stat(audioPath);
  if (bytes < 1) {
    throw new AssemblyError("empty_audio");
  }
  signal?.throwIfAborted();
  await uploadAudio(`${jobUrl}/audio`, audioPath, {
    bytes,
    fetchImpl,
    signal,
    token: command.token,
  });
  return { bytes, durationSeconds };
};

export const assemblyEffect = (input, options = {}) =>
  Effect.scoped(
    Effect.gen(function* assembleScoped() {
      const command = yield* Effect.try({
        catch: (error) => error,
        try: () => validateAssembleInput(input, options),
      });
      const resource = yield* Effect.acquireRelease(
        Effect.tryPromise({
          catch: () => new AssemblyError("temporary_directory_failed", 500),
          try: async () => ({
            controller: new AbortController(),
            directory: await mkdtemp(
              path.join(options.tempRoot ?? tmpdir(), "assembler-")
            ),
            task: undefined,
          }),
        }),
        (acquired) =>
          Effect.promise(async () => {
            acquired.controller.abort();
            // Effect interruption must not remove files while Promise I/O is still active.
            await acquired.task?.catch(() => {
              // The operation already reports its failure; cleanup only waits for I/O to stop.
            });
            await rm(acquired.directory, { force: true, recursive: true });
          })
      );
      return yield* Effect.tryPromise({
        catch: (error) =>
          error instanceof AssemblyError
            ? error
            : new AssemblyError("assembly_failed"),
        try: (signal) => {
          resource.task = assembleInDirectory(command, resource.directory, {
            ...options,
            signal: AbortSignal.any([signal, resource.controller.signal]),
          });
          return resource.task;
        },
      });
    })
  );

// A runtime boundary for the HTTP server, tests, and the manual smoke check.
export const assemble = (input, options = {}) =>
  Effect.runPromise(assemblyEffect(input, options), {
    signal: options.signal,
  });
