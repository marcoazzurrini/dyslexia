import { describe, expect, test } from "bun:test";

import { spendingFetch } from "../evals/spending.ts";

const answered = (cost: number): typeof globalThis.fetch =>
  Object.assign(() => Promise.resolve(Response.json({ usage: { cost } })), {
    preconnect: globalThis.fetch.preconnect,
  });

const ask = (
  fetch: typeof globalThis.fetch,
  format: string,
  url = "https://openrouter.ai/api/v1/chat/completions"
) =>
  fetch(url, {
    body: JSON.stringify({
      model: "anthropic/claude-opus-5.5",
      response_format: { json_schema: { name: format } },
    }),
    method: "POST",
  });

describe("the eval's spending", () => {
  test("keeps writing and judging apart, even with the same model", async () => {
    const spending = spendingFetch(answered(0.25));
    await ask(spending.fetch, "narration");
    await ask(spending.fetch, "verdict");
    await ask(spending.fetch, "verdict");
    expect(spending.take()).toEqual({ judging: 0.5, writing: 0.25 });
    expect(spending.take()).toEqual({ judging: 0, writing: 0 });
  });

  test("counts only OpenRouter", async () => {
    const spending = spendingFetch(answered(1));
    await ask(spending.fetch, "narration", "https://cloud.langfuse.com/api");
    expect(spending.take()).toEqual({ judging: 0, writing: 0 });
  });
});
