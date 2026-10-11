import { Context, Effect, Layer, Option, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { MAX_PICTURE_BYTES } from "../limits.ts";

/** A picture from an article, to keep with its narration. */
export interface Picture {
  readonly bytes: Uint8Array;
  /** Its media type, such as image/png. */
  readonly type: string;
}

/** The picture formats browsers show everywhere. */
export const PICTURE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

/** Fetches the pictures of an article, so they outlive the page. */
export class Pictures extends Context.Service<
  Pictures,
  {
    /**
     * The picture at `url`, or none when it cannot be fetched, is too large,
     * or is not a picture. A missing picture never stops a narration.
     */
    readonly fetch: (url: string) => Effect.Effect<Option.Option<Picture>>;
  }
>()("narrations/Pictures") {
  /** Fetches pictures over the web, as a browser would. */
  static readonly layer = Layer.effect(
    Pictures,
    Effect.gen(function* makePictures() {
      const client = yield* HttpClient.HttpClient;
      const fetch = Effect.fn("Pictures.fetch")(function* picturesFetch(
        url: string
      ) {
        yield* Effect.annotateCurrentSpan("picture.url", url);
        const response = yield* client.execute(
          HttpClientRequest.get(url).pipe(
            HttpClientRequest.setHeader("Accept", "image/*")
          )
        );
        const type =
          response.headers["content-type"]
            ?.split(";")[0]
            ?.trim()
            .toLowerCase() ?? "";
        if (response.status !== 200 || !PICTURE_TYPES.has(type)) {
          return Option.none();
        }
        const parts: Uint8Array[] = [];
        let length = 0;
        const fits = yield* response.stream.pipe(
          Stream.runForEachWhile((part) => {
            length += part.byteLength;
            parts.push(part);
            return Effect.succeed(length <= MAX_PICTURE_BYTES);
          }),
          Effect.map(() => length <= MAX_PICTURE_BYTES)
        );
        if (!fits || length === 0) {
          return Option.none();
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const part of parts) {
          bytes.set(part, offset);
          offset += part.byteLength;
        }
        yield* Effect.annotateCurrentSpan("picture.bytes", length);
        return Option.some({ bytes, type });
      });
      return {
        fetch: (url: string) =>
          fetch(url).pipe(
            Effect.timeoutOrElse({
              duration: "30 seconds",
              orElse: () => Effect.succeed(Option.none<Picture>()),
            }),
            Effect.orElseSucceed(() => Option.none<Picture>())
          ),
      };
    })
  );
}
