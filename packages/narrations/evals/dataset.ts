/**
 * Reads each eval article with the real reader and saves its text in the
 * Langfuse dataset. Articles already saved are kept, so scores stay
 * comparable. To read some again, name them:
 * `bun run eval:dataset italian formulas`.
 */
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";

import { MAX_ARTICLE_CHARACTERS } from "../src/limits.ts";
import { Reader } from "../src/services/reader.ts";
import { CASES } from "./cases.ts";
import { ensureDataset, findItem, itemIdOf, saveItem } from "./langfuse.ts";

const refresh = new Set(process.argv.slice(2));

const reader = Reader.layer.pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromEnv({
        env: { FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ?? "" },
      })
    )
  )
);

const saveCase = Effect.fn("saveCase")(function* saveCase(
  testCase: (typeof CASES)[number]
) {
  const id = itemIdOf(testCase.id);
  if (!refresh.has(testCase.id) && (yield* findItem(id))) {
    return `${testCase.id}: already saved`;
  }
  const read = yield* Effect.result((yield* Reader).read(testCase.url));
  if (read._tag === "Failure") {
    return `${testCase.id}: could not read ${testCase.url} (${read.failure._tag})`;
  }
  const article = read.success;
  yield* saveItem({
    id,
    input: { link: testCase.url, ...article },
    metadata: {
      case: testCase.id,
      heldOut: testCase.heldOut ?? false,
      tests: testCase.tests,
    },
  });
  const tooLong =
    article.text.length > MAX_ARTICLE_CHARACTERS
      ? " (over the app's limit)"
      : "";
  return `${testCase.id}: saved ${article.text.length} characters${tooLong}`;
});

await Effect.runPromise(
  Effect.gen(function* saveDataset() {
    yield* ensureDataset;
    for (const testCase of CASES) {
      console.log(yield* saveCase(testCase));
    }
  }).pipe(
    Effect.provide(reader),
    Effect.provide(FetchHttpClient.layer),
    Effect.withTracerEnabled(false)
  )
);
