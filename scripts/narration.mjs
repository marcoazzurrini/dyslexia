import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const endpoint = "https://api.elevenlabs.io/v1";
const format = "mp3_44100_128";
const settings = { similarity_boost: 0.75, stability: 0.7 };
const digest = (value) => createHash("sha256").update(value).digest("hex");

export const splitNarration = (input, limit = 4000) => {
  if (!Number.isInteger(limit) || limit < 100 || limit > 10_000) {
    throw new Error("Chunk size must be an integer from 100 to 10000.");
  }
  let text = input.replaceAll("\r\n", "\n").trim();
  if (!text) {
    throw new Error("Narration is empty.");
  }
  const chunks = [];
  while (text.length > limit) {
    const candidate = text.slice(0, limit);
    const paragraph = candidate.lastIndexOf("\n\n");
    const sentences = [...candidate.matchAll(/[.!?]\s+/gu)];
    const sentence = sentences.at(-1)?.index;
    const spaces = [...candidate.matchAll(/\s/gu)];
    const space = spaces.at(-1)?.index;
    let boundary = sentence === undefined ? space : sentence + 1;
    if (paragraph > limit / 2) {
      boundary = paragraph;
    }
    if (boundary === undefined || boundary < 1) {
      throw new Error(
        "An unbroken text span exceeds the chunk limit. Review the narration."
      );
    }
    chunks.push(text.slice(0, boundary).trim());
    text = text.slice(boundary).trim();
  }
  chunks.push(text);
  return chunks;
};

export const makePlan = (text, voiceId, limit = 4000) => {
  const chunks = splitNarration(text, limit).map((chunk) => {
    const body = {
      model_id: "eleven_v4",
      text: chunk,
      voice_settings: settings,
    };
    return {
      body,
      id: digest(JSON.stringify({ body, format, revision: 1, voiceId })),
    };
  });
  return {
    characters: chunks.reduce((sum, chunk) => sum + chunk.body.text.length, 0),
    chunks,
    id: digest(JSON.stringify(chunks.map((chunk) => chunk.id))).slice(0, 16),
    model: "eleven_v4",
    voiceId,
  };
};

const writeJson = async (filename, value) => {
  await writeFile(`${filename}.tmp`, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(`${filename}.tmp`, filename);
};

export const cachedAudio = async (chunk, directory) => {
  const audioPath = path.join(directory, `${chunk.id}.mp3`);
  const receiptPath = path.join(directory, `${chunk.id}.json`);
  if (!existsSync(receiptPath)) {
    return;
  }
  const receipt = JSON.parse(await readFile(receiptPath, "utf-8"));
  const bytes = await readFile(audioPath);
  if (
    receipt.id !== chunk.id ||
    receipt.sha256 !== digest(bytes) ||
    bytes.length === 0
  ) {
    throw new Error(
      `Cached audio is damaged: ${audioPath}. Review it before regenerating.`
    );
  }
  return audioPath;
};

export const generateChunk = async (chunk, options) => {
  const { apiKey, directory, voiceId, fetchAudio = fetch } = options;
  const cached = await cachedAudio(chunk, directory);
  if (cached) {
    return cached;
  }
  const audioPath = path.join(directory, `${chunk.id}.mp3`);
  const pendingPath = path.join(directory, `${chunk.id}.pending`);
  // Persist intent before sending a paid request. A timeout may still incur a charge.
  const pending = await open(pendingPath, "wx", 0o600).catch((error) => {
    if (error.code === "EEXIST") {
      throw new Error(
        `Unconfirmed request: ${pendingPath}. Check ElevenLabs history before retrying.`
      );
    }
    throw error;
  });
  await pending.close();
  const response = await fetchAudio(
    `${endpoint}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${format}`,
    {
      body: JSON.stringify(chunk.body),
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(180_000),
    }
  );
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const knownFailures = new Set([
      "invalid_api_key",
      "missing_permissions",
      "quota_exceeded",
      "model_not_found",
      "voice_not_found",
      "invalid_voice_id",
      "model_not_supported",
    ]);
    const category = knownFailures.has(failure.detail?.status)
      ? ` (${failure.detail.status})`
      : "";
    throw new Error(
      `ElevenLabs HTTP ${response.status}${category}. No automatic retry. Check account history and the pending marker.`
    );
  }
  if (!response.headers.get("content-type")?.includes("audio/")) {
    throw new Error(
      "ElevenLabs returned a non-audio response. The request remains unconfirmed."
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error(
      "ElevenLabs returned empty audio. The request remains unconfirmed."
    );
  }
  await writeFile(`${audioPath}.tmp`, bytes, { mode: 0o600 });
  await rename(`${audioPath}.tmp`, audioPath);
  await writeJson(path.join(directory, `${chunk.id}.json`), {
    characters: chunk.body.text.length,
    id: chunk.id,
    requestId: response.headers.get("request-id"),
    sha256: digest(bytes),
  });
  await rm(pendingPath);
  return audioPath;
};

const checkFfmpeg = () => {
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
    throw new Error(
      "Install ffmpeg before generating audio; it assembles the recording."
    );
  }
};

const assemble = (directory, output) => {
  const listPath = path.join(directory, "concat.txt");
  const temporary = `${output}.tmp.mp3`;
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "1",
      "-i",
      listPath,
      "-map_metadata",
      "-1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      temporary,
    ],
    { encoding: "utf-8" }
  );
  if (result.status !== 0) {
    throw new Error(
      `Audio assembly failed. Saved chunks can be reused. ${result.stderr || ""}`
    );
  }
  return rename(temporary, output);
};

const listVoices = async (apiKey) => {
  const response = await fetch(
    "https://api.elevenlabs.io/v2/voices?page_size=100",
    {
      headers: { "xi-api-key": apiKey },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(`Voice lookup: ElevenLabs HTTP ${response.status}.`);
  }
  const result = await response.json();
  for (const voice of result.voices) {
    console.log(`${voice.voice_id}\t${voice.name}`);
  }
  if (result.has_more) {
    console.log("More voices are available in your ElevenLabs library.");
  }
};

const parseRate = (value) => {
  if (value === undefined) {
    return;
  }
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      "--rate-usd-per-1k must be a positive number from your account pricing."
    );
  }
  return rate;
};

const run = async () => {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const { values } = parseArgs({
    options: {
      "chunk-size": { default: "4000", type: "string" },
      generate: { type: "boolean" },
      help: { type: "boolean" },
      input: { type: "string" },
      output: { default: ".local/narration/audio", type: "string" },
      "rate-usd-per-1k": { type: "string" },
      voice: { type: "string" },
      voices: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "npm run narrate -- --input narration.txt [--voice ID] [--rate-usd-per-1k RATE] [--generate]\nWithout --generate, prints a local plan only. Use --voices to list account voices."
    );
    return;
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if ((values.generate || values.voices) && !apiKey) {
    throw new Error(
      "Set ELEVENLABS_API_KEY in .env. Never use a VITE_ prefix."
    );
  }
  if (values.voices) {
    await listVoices(apiKey);
    return;
  }
  if (!values.input) {
    throw new Error(
      "Provide --input with a reviewed plain-text narration file."
    );
  }
  const voiceId = values.voice || process.env.ELEVENLABS_VOICE_ID;
  const plan = makePlan(
    await readFile(values.input, "utf-8"),
    voiceId || "not-selected",
    Number(values["chunk-size"])
  );
  const rate = parseRate(values["rate-usd-per-1k"]);
  const directory = path.resolve(values.output);
  const cached = await Promise.all(
    plan.chunks.map((chunk) => cachedAudio(chunk, directory))
  );
  const uncachedCharacters = plan.chunks.reduce(
    (total, chunk, index) =>
      total + (cached[index] ? 0 : chunk.body.text.length),
    0
  );
  console.log(`Model: ${plan.model}. Voice: ${voiceId || "not selected"}.`);
  console.log(
    `${plan.chunks.length} chunks; ${plan.characters} characters total; ${uncachedCharacters} characters need generation.`
  );
  console.log(
    rate === undefined
      ? "Cost not estimated. Supply --rate-usd-per-1k from your account pricing."
      : `Estimated generation cost: $${((uncachedCharacters / 1000) * rate).toFixed(4)} before tax, voice surcharges, or plan allowances.`
  );
  if (!values.generate) {
    console.log("Dry run. No API requests or audio generation.");
    return;
  }
  if (!voiceId || rate === undefined) {
    throw new Error(
      "Generation requires --voice (or ELEVENLABS_VOICE_ID) and --rate-usd-per-1k. Review the dry run first."
    );
  }
  checkFfmpeg();
  await mkdir(directory, { mode: 0o700, recursive: true });
  const lockPath = path.join(directory, "generation.lock");
  const lock = await open(lockPath, "wx", 0o600);
  try {
    await writeJson(path.join(directory, `plan-${plan.id}.json`), plan);
    // Sequential paid requests keep rate limits and partial failures predictable.
    for await (const [index, chunk] of plan.chunks.entries()) {
      await generateChunk(chunk, { apiKey, directory, voiceId });
      console.log(`Chunk ${index + 1}/${plan.chunks.length} saved or reused.`);
    }
    await writeFile(
      path.join(directory, "concat.txt"),
      plan.chunks.map((chunk) => `file '${chunk.id}.mp3'`).join("\n")
    );
    const output = path.join(directory, `narration-${plan.id}.mp3`);
    await assemble(directory, output);
    console.log(
      `Recording: ${output}\nListen through the recording before publishing it.`
    );
  } finally {
    await lock.close();
    await rm(lockPath);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  await run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
