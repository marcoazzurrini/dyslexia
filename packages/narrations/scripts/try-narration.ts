/**
 * Reads an article and writes its narration script with the real services,
 * without recording speech or saving anything. Use it to judge a change to
 * the writing prompt: `bun run try <article link>`.
 */
import { Effect } from "effect";

import { servicesFor } from "../src/layers.ts";
import { observationInput, observationOutput } from "../src/observation.ts";
import { Reader } from "../src/services/reader.ts";
import { Writer } from "../src/services/writer.ts";
import { narrationTracingFor } from "../src/telemetry.ts";

const [url] = process.argv.slice(2);
if (!url) {
  console.error("Usage: bun run try <article link>");
  process.exit(1);
}

const { article, script } = await Effect.runPromise(
  Effect.gen(function* narrate() {
    const read = yield* (yield* Reader).read(url);
    const written = yield* (yield* Writer).write(read);
    yield* Effect.annotateCurrentSpan(
      observationOutput({
        articleCharacters: read.text.length,
        scriptCharacters: written.text.length,
        title: written.title,
      })
    );
    return { article: read, script: written };
  }).pipe(
    Effect.withSpan("try narration", {
      attributes: { "article.url": url, ...observationInput({ link: url }) },
    }),
    Effect.provide(
      servicesFor({
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      })
    ),
    // Sends the trace to Langfuse before exiting, when its keys are set.
    Effect.provide(
      narrationTracingFor({
        LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
        LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
        LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
        LANGFUSE_TRACING_ENVIRONMENT: process.env.LANGFUSE_TRACING_ENVIRONMENT,
      })
    )
  )
);

console.error(
  `${script.title} (page title: ${article.title}): article ${article.text.length} characters, script ${script.text.length} characters\n`
);
console.log(script.text);
