import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { ArticleUnreadable } from "../errors.ts";
import type { ServiceRejected, ServiceUnavailable } from "../errors.ts";
import { decodeJson, send } from "./send.ts";

/** The readable text of a web page. */
export const ArticleSchema = Schema.Struct({
  /** Markdown. */
  text: Schema.String,
  title: Schema.String,
});
export type Article = typeof ArticleSchema.Type;

const Scraped = Schema.Struct({
  data: Schema.Struct({
    markdown: Schema.String,
    metadata: Schema.Struct({
      statusCode: Schema.optional(Schema.Number),
      title: Schema.optional(Schema.String),
    }),
  }),
  success: Schema.Literal(true),
});

const siteOf = (url: string) => new URL(url).hostname.replace(/^www\./u, "");

/** Reads the article on a web page. */
export class Reader extends Context.Service<
  Reader,
  {
    readonly read: (
      url: string
    ) => Effect.Effect<
      Article,
      ArticleUnreadable | ServiceUnavailable | ServiceRejected
    >;
  }
>()("narrations/Reader") {
  /** Reads pages with Firecrawl, which fetches them for us. */
  static readonly layer = Layer.effect(
    Reader,
    Effect.gen(function* makeReader() {
      const key = yield* Config.Redacted("FIRECRAWL_API_KEY");
      const client = yield* HttpClient.HttpClient;
      const read = Effect.fn("Reader.read")(function* readerRead(url: string) {
        const body = yield* send(
          "reader",
          HttpClientRequest.post("https://api.firecrawl.dev/v2/scrape").pipe(
            HttpClientRequest.bearerToken(Redacted.value(key)),
            HttpClientRequest.bodyJsonUnsafe({
              formats: ["markdown"],
              onlyMainContent: true,
              url,
            })
          ),
          { limit: 2 * 1024 * 1024, timeout: "2 minutes" }
        ).pipe(
          // Firecrawl answers most pages it cannot read with a 4xx status.
          Effect.catchTag("ServiceRejected", (error) =>
            Effect.fail(
              error.status === 401 || error.status === 402
                ? error
                : new ArticleUnreadable()
            )
          ),
          Effect.provideService(HttpClient.HttpClient, client)
        );
        const { data } = yield* decodeJson(Scraped)(
          body,
          () => new ArticleUnreadable()
        );
        const status = data.metadata.statusCode ?? 200;
        if (status < 200 || status >= 300 || !data.markdown.trim()) {
          return yield* new ArticleUnreadable();
        }
        return {
          text: data.markdown.trim(),
          title: data.metadata.title?.trim() || siteOf(url),
        };
      });
      return { read };
    })
  );
}
