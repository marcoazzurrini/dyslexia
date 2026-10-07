/**
 * Reads an article and writes its narration script with the real services,
 * without recording speech or saving anything. Use it to judge a change to
 * the writing prompt: `bun run try <article link>`.
 */
import { Effect } from "effect";

import { servicesFor } from "../src/layers.ts";
import { Reader } from "../src/services/reader.ts";
import { Writer } from "../src/services/writer.ts";

const [url] = process.argv.slice(2);
if (!url) {
  console.error("Usage: bun run try <article link>");
  process.exit(1);
}

const { article, script } = await Effect.runPromise(
  Effect.gen(function* narrate() {
    const read = yield* (yield* Reader).read(url);
    const written = yield* (yield* Writer).write(read);
    return { article: read, script: written };
  }).pipe(
    Effect.provide(
      servicesFor({
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      })
    )
  )
);

console.error(
  `${article.title}: article ${article.text.length} characters, script ${script.length} characters\n`
);
console.log(script);
