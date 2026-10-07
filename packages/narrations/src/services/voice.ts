import { Config, Context, Effect, Layer, Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { ServiceUnavailable } from "../errors.ts";
import type { ServiceRejected } from "../errors.ts";
import { send } from "./send.ts";

const VOICE = "JBFqnCBsd6RMkjVDRZzb";
const MODEL = "eleven_v4";
/** Constant bitrate MP3, which joins into one seekable file. */
const FORMAT = "mp3_44100_128";

/** Reads text aloud. */
export class Voice extends Context.Service<
  Voice,
  {
    /** MP3 audio of the text. */
    readonly speak: (
      text: string
    ) => Effect.Effect<Uint8Array, ServiceUnavailable | ServiceRejected>;
  }
>()("narrations/Voice") {
  /** Speaks with ElevenLabs. */
  static readonly layer = Layer.effect(
    Voice,
    Effect.gen(function* makeVoice() {
      const key = yield* Config.Redacted("ELEVENLABS_API_KEY");
      const client = yield* HttpClient.HttpClient;
      const speak = Effect.fn("Voice.speak")(function* voiceSpeak(
        text: string
      ) {
        const audio = yield* send(
          "voice",
          HttpClientRequest.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`
          ).pipe(
            HttpClientRequest.setUrlParam("output_format", FORMAT),
            HttpClientRequest.setHeader("xi-api-key", Redacted.value(key)),
            HttpClientRequest.bodyJsonUnsafe({ model_id: MODEL, text })
          ),
          { limit: 8 * 1024 * 1024, timeout: "3 minutes" }
        ).pipe(Effect.provideService(HttpClient.HttpClient, client));
        if (audio.byteLength === 0) {
          return yield* new ServiceUnavailable({ service: "voice" });
        }
        return audio;
      });
      return { speak };
    })
  );
}
