import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { ScriptIncomplete } from "../errors.ts";
import type { ServiceRejected, ServiceUnavailable } from "../errors.ts";
import {
  modelParameters,
  observationInput,
  observationOutput,
  observationType,
} from "../observation.ts";
import type { Article } from "./reader.ts";
import { decodeJson, send } from "./send.ts";
import { WRITING_PROMPT } from "./writing-prompt.ts";

/** The model and prompt the writer uses. */
export interface WritingSettings {
  readonly model: string;
  readonly prompt: string;
  readonly reasoning: "low" | "medium" | "high";
}

/** The writer's settings. The narration eval swaps them to compare others. */
export const WriterSettings = Context.Reference<WritingSettings>(
  "narrations/WriterSettings",
  {
    defaultValue: () => ({
      model: "openai/gpt-6.1-sol",
      prompt: WRITING_PROMPT,
      reasoning: "medium",
    }),
  }
);

const Completion = Schema.Struct({
  choices: Schema.Array(
    Schema.Struct({
      finish_reason: Schema.NullOr(Schema.String),
      message: Schema.Struct({
        content: Schema.NullOr(Schema.String),
        reasoning: Schema.optional(Schema.NullOr(Schema.String)),
        refusal: Schema.optional(Schema.NullOr(Schema.String)),
      }),
    })
  ),
  model: Schema.optional(Schema.String),
  usage: Schema.optional(
    Schema.Struct({
      completion_tokens: Schema.Number,
      cost: Schema.optional(Schema.Number),
      prompt_tokens: Schema.Number,
    })
  ),
});

/** A narration script and the title to show it under. */
export const ScriptSchema = Schema.Struct({
  text: Schema.String,
  title: Schema.String,
});
export type Script = typeof ScriptSchema.Type;

const Answer = Schema.fromJsonString(ScriptSchema);

/** Rewrites an article as a script to be read aloud. */
export class Writer extends Context.Service<
  Writer,
  {
    readonly write: (
      article: Article
    ) => Effect.Effect<
      Script,
      ScriptIncomplete | ServiceUnavailable | ServiceRejected
    >;
  }
>()("narrations/Writer") {
  /** Writes with a language model through OpenRouter. */
  static readonly layer = Layer.effect(
    Writer,
    Effect.gen(function* makeWriter() {
      const key = yield* Config.Redacted("OPENROUTER_API_KEY");
      const client = yield* HttpClient.HttpClient;
      const write = Effect.fn("Writer.write")(function* writerWrite(
        article: Article
      ) {
        const {
          model: requested,
          prompt,
          reasoning: effort,
        } = yield* WriterSettings;
        const messages = [
          { content: prompt, role: "system" },
          { content: JSON.stringify(article), role: "user" },
        ];
        const settings = {
          max_completion_tokens: 64_000,
          reasoning: { effort },
        };
        yield* Effect.annotateCurrentSpan({
          "article.characters": article.text.length,
          "gen_ai.provider.name": "openrouter",
          "gen_ai.request.model": requested,
          ...observationType("generation"),
          ...observationInput(messages),
          ...modelParameters({
            max_completion_tokens: settings.max_completion_tokens,
            reasoning_effort: settings.reasoning.effort,
          }),
        });
        const body = yield* send(
          "writer",
          HttpClientRequest.post(
            "https://openrouter.ai/api/v1/chat/completions"
          ).pipe(
            HttpClientRequest.bearerToken(Redacted.value(key)),
            HttpClientRequest.bodyJsonUnsafe({
              ...settings,
              messages,
              model: requested,
              response_format: {
                json_schema: {
                  name: "narration",
                  schema: {
                    additionalProperties: false,
                    properties: {
                      text: { type: "string" },
                      title: { type: "string" },
                    },
                    required: ["text", "title"],
                    type: "object",
                  },
                  strict: true,
                },
                type: "json_schema",
              },
              stream: false,
            })
          ),
          { limit: 4 * 1024 * 1024, timeout: "10 minutes" }
        ).pipe(Effect.provideService(HttpClient.HttpClient, client));
        const { choices, model, usage } = yield* decodeJson(Completion)(
          body,
          () => new ScriptIncomplete()
        );
        const [choice] = choices;
        const reasoning = choice?.message.reasoning ?? undefined;
        // The raw answer, until it is known to be a whole script.
        yield* Effect.annotateCurrentSpan({
          ...(choice &&
            observationOutput({
              content: choice.message.content,
              reasoning,
              role: "assistant",
            })),
          "gen_ai.response.finish_reason": choice?.finish_reason ?? undefined,
          "gen_ai.response.model": model,
          "gen_ai.usage.cost": usage?.cost,
          "gen_ai.usage.input_tokens": usage?.prompt_tokens,
          "gen_ai.usage.output_tokens": usage?.completion_tokens,
        });
        // A cut-off answer ends for another reason than "stop".
        if (
          choices.length !== 1 ||
          choice?.finish_reason !== "stop" ||
          choice.message.refusal ||
          choice.message.content === null
        ) {
          return yield* new ScriptIncomplete();
        }
        const { text, title } = yield* Schema.decodeUnknownEffect(Answer)(
          choice.message.content
        ).pipe(Effect.mapError(() => new ScriptIncomplete()));
        yield* Effect.annotateCurrentSpan({
          "script.characters": text.length,
          // The script itself, easier to read than the JSON it came in.
          ...observationOutput({
            content: text,
            reasoning,
            role: "assistant",
            title,
          }),
        });
        // The page's own title is still better than none.
        return { text, title: title.trim() || article.title };
      });
      return { write };
    })
  );
}
