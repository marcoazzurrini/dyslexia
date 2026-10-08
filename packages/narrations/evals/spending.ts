import { Schema } from "effect";

// What each run cost, from the price OpenRouter reports with every answer.

const Answer = Schema.Struct({
  model: Schema.optional(Schema.String),
  usage: Schema.optional(
    Schema.Struct({ cost: Schema.optional(Schema.Number) })
  ),
});
const decodeAnswer = Schema.decodeUnknownOption(Answer);

/** A `fetch` that adds up what OpenRouter charged, by model. */
export const spendingFetch = (send: typeof globalThis.fetch) => {
  const spent = new Map<string, number>();
  const fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await send(input, init);
      const url = input instanceof Request ? input.url : String(input);
      if (new URL(url).host === "openrouter.ai" && response.ok) {
        const answer = decodeAnswer(
          await response
            .clone()
            .json()
            .catch(() => null)
        );
        if (answer._tag === "Some") {
          const { model = "unknown", usage } = answer.value;
          spent.set(model, (spent.get(model) ?? 0) + (usage?.cost ?? 0));
        }
      }
      return response;
    },
    { preconnect: send.preconnect }
  );
  return {
    fetch,
    /** Returns the spending since the last call, and starts again. */
    take: () => {
      const taken = new Map(spent);
      spent.clear();
      return taken;
    },
  };
};
