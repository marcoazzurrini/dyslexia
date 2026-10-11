/**
 * Narrates an article with the real services, without the Worker. Use it to
 * judge a change to the writing prompt, or to hear and read a narration.
 *
 *   bun run try <article link>                   write the script and print it
 *   bun run try <article link> --record <folder>  also record it, and save
 *                                                 audio.mp3 and transcript.json
 *   bun run try <article.md> --record <folder>    narrate a Markdown file
 *
 * Recording runs the whole narration, as the Worker does, with storage in
 * memory, and costs as much as a narration made in the app.
 */
import "../test/support/workers.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { spokenText } from "@dyslexia/transcript/making";
import { Effect, Layer, ManagedRuntime } from "effect";

import { servicesFor } from "../src/layers.ts";
import { observationInput, observationOutput } from "../src/observation.ts";
import { Reader } from "../src/services/reader.ts";
import { Store } from "../src/services/store.ts";
import { Writer } from "../src/services/writer.ts";
import { narrationTracingFor } from "../src/telemetry.ts";
import { makeNarration } from "../src/workflow.ts";
import { memoryBucket } from "../test/support/bucket.ts";
import { fakeSteps } from "../test/support/fakes.ts";

const {
  positionals: [source],
  values: options,
} = parseArgs({
  allowPositionals: true,
  options: { record: { type: "string" } },
});
if (!source) {
  console.error(
    "Usage: bun run try <article link or Markdown file> [--record <folder>]"
  );
  process.exit(1);
}

const isFile = !/^https?:\/\//u.test(source);
// A Markdown file stands in for a page on example.org, titled by its file.
const link = isFile ? `https://example.org/${path.basename(source)}` : source;
const reader = isFile
  ? Layer.succeed(Reader, {
      read: () =>
        Effect.succeed({
          text: readFileSync(source, "utf-8"),
          title: path.basename(source, path.extname(source)),
        }),
    })
  : Layer.empty;

const services = Layer.mergeAll(
  servicesFor({
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  }),
  reader
);

// Sends traces to Langfuse before exiting, when its keys are set.
const tracing = narrationTracingFor({
  LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
  LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
  LANGFUSE_TRACING_ENVIRONMENT: process.env.LANGFUSE_TRACING_ENVIRONMENT,
});

const write = async () => {
  const { article, script } = await Effect.runPromise(
    Effect.gen(function* narrate() {
      const read = yield* (yield* Reader).read(link);
      const written = yield* (yield* Writer).write({
        markdown: read.text,
        title: read.title,
        url: link,
      });
      yield* Effect.annotateCurrentSpan(
        observationOutput({
          articleCharacters: read.text.length,
          scriptCharacters: spokenText(written).length,
          title: written.title,
        })
      );
      return { article: read, script: written };
    }).pipe(
      Effect.withSpan("try narration", {
        attributes: { "article.url": link, ...observationInput({ link }) },
      }),
      Effect.provide(services),
      Effect.provide(tracing)
    )
  );
  console.error(
    `${script.title} (page title: ${article.title}): article ${article.text.length} characters, script ${spokenText(script).length} characters\n`
  );
  for (const item of script.items) {
    const label =
      item.kind === "visual" ? `[visual ${item.visual}]` : `[${item.kind}]`;
    console.log(`${label} ${item.say}\n`);
  }
};

const record = async (folder: string) => {
  const memory = memoryBucket();
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(services, Store.layer(memory.bucket), tracing)
  );
  const { id } = await runtime.runPromise(
    Effect.gen(function* create() {
      return yield* (yield* Store).create(link);
    })
  );
  const steps = fakeSteps();
  const started = Date.now();
  await makeNarration(id, steps.step, runtime);
  await runtime.dispose();
  mkdirSync(folder, { recursive: true });
  for (const name of ["audio.mp3", "transcript.json"]) {
    const stored = memory.files.get(`narrations/${id}/${name}`);
    if (!stored) {
      throw new Error(`The narration made no ${name}`);
    }
    writeFileSync(path.join(folder, name), stored.bytes);
  }
  console.error(
    `${steps.names().join(" → ")}\nSaved audio.mp3 and transcript.json in ${folder} after ${Math.round((Date.now() - started) / 1000)} s.`
  );
};

await (options.record ? record(options.record) : write());
