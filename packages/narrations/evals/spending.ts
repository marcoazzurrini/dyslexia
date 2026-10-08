import { Schema } from "effect";

import { VERDICT } from "./judge.ts";

// What each run cost, from the price OpenRouter reports with every answer.
// A request is the judge's when it asks for a verdict, and the writer's
// otherwise, so the two stay apart even when they use the same model.

const Sent = Schema.Struct({
  response_format: Schema.optional(
    Schema.Struct({
      json_schema: Schema.optional(
        Schema.Struct({ name: Schema.optional(Schema.String) })
      ),
    })
  ),
});
const decodeSent = Schema.decodeUnknownOption(Schema.fromJsonString(Sent));

const Answer = Schema.Struct({
  usage: Schema.optional(
    Schema.Struct({ cost: Schema.optional(Schema.Number) })
  ),
});
const decodeAnswer = Schema.decodeUnknownOption(Answer);

export type Spending = Record<"writing" | "judging", number>;

/** A `fetch` that adds up what OpenRouter charged for writing and judging. */
export const spendingFetch = (send: typeof globalThis.fetch) => {
  let spent: Spending = { judging: 0, writing: 0 };
  const fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (new URL(request.url).host !== "openrouter.ai") {
        return send(request);
      }
      const sent = decodeSent(await request.clone().text());
      const response = await send(request);
      const answer = decodeAnswer(
        await response
          .clone()
          .json()
          .catch(() => null)
      );
      if (response.ok && answer._tag === "Some") {
        const judging =
          sent._tag === "Some" &&
          sent.value.response_format?.json_schema?.name === VERDICT;
        spent[judging ? "judging" : "writing"] += answer.value.usage?.cost ?? 0;
      }
      return response;
    },
    { preconnect: send.preconnect }
  );
  return {
    fetch,
    /** Returns the spending since the last call, and starts again. */
    take: (): Spending => {
      const taken = spent;
      spent = { judging: 0, writing: 0 };
      return taken;
    },
  };
};
