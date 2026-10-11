import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { ServiceUnavailable } from "../errors.ts";
import type { ServiceRejected } from "../errors.ts";
import {
  modelParameters,
  observationInput,
  observationOutput,
  observationType,
} from "../observation.ts";
import { decodeJson, send } from "./send.ts";

const VOICE = "JBFqnCBsd6RMkjVDRZzb";
const MODEL = "eleven_v4";
/** Constant bitrate MP3, which joins into one seekable file. */
const FORMAT = "mp3_44100_128";

/** Speech, and when each character of its text is said. */
export interface Speech {
  /** MP3 audio of the text. */
  readonly audio: Uint8Array;
  /**
   * When each character of the text starts, in seconds into the audio: one
   * time for each UTF-16 code unit, so `starts[i]` times `text[i]`.
   */
  readonly starts: readonly number[];
}

const Timed = Schema.Struct({
  alignment: Schema.NullOr(
    Schema.Struct({
      character_start_times_seconds: Schema.Array(Schema.Finite),
      characters: Schema.Array(Schema.String),
    })
  ),
  audio_base64: Schema.String,
});

const unavailable = () => new ServiceUnavailable({ service: "voice" });

/** Bytes from Base64 text, or none when it is not Base64. */
const fromBase64 = (text: string) => {
  try {
    return Uint8Array.from(
      atob(text),
      (character) => character.codePointAt(0) ?? 0
    );
  } catch {
    return new Uint8Array();
  }
};

/**
 * Times every character of `text` from the voice's alignment, which lists
 * the characters it said. Characters it does not list, such as any it
 * dropped, take the time of the character before them.
 */
export const timeCharacters = (
  text: string,
  characters: readonly string[],
  times: readonly number[]
): number[] => {
  const starts = Array.from<number | undefined>({ length: text.length });
  let at = 0;
  for (const [index, character] of characters.entries()) {
    const found = text.indexOf(character, at);
    // Skip a character the text does not hold next, rather than jump ahead.
    if (character && found !== -1 && found - at <= character.length) {
      for (let unit = found; unit < found + character.length; unit += 1) {
        starts[unit] = times[index] ?? 0;
      }
      at = found + character.length;
    }
  }
  let previous = 0;
  return starts.map((start) => {
    previous = start ?? previous;
    return previous;
  });
};

/** Reads text aloud. */
export class Voice extends Context.Service<
  Voice,
  {
    readonly speak: (
      text: string
    ) => Effect.Effect<Speech, ServiceUnavailable | ServiceRejected>;
  }
>()("narrations/Voice") {
  /** Speaks with ElevenLabs, which also says when it said each character. */
  static readonly layer = Layer.effect(
    Voice,
    Effect.gen(function* makeVoice() {
      const key = yield* Config.Redacted("ELEVENLABS_API_KEY");
      const client = yield* HttpClient.HttpClient;
      const speak = Effect.fn("Voice.speak")(function* voiceSpeak(
        text: string
      ) {
        // ElevenLabs charges by the character.
        yield* Effect.annotateCurrentSpan({
          "gen_ai.provider.name": "elevenlabs",
          "gen_ai.request.model": MODEL,
          "voice.characters": text.length,
          "voice.model": MODEL,
          ...observationType("generation"),
          ...observationInput(text),
          ...modelParameters({ output_format: FORMAT, voice_id: VOICE }),
        });
        const body = yield* send(
          "voice",
          HttpClientRequest.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps`
          ).pipe(
            HttpClientRequest.setUrlParam("output_format", FORMAT),
            HttpClientRequest.setHeader("xi-api-key", Redacted.value(key)),
            HttpClientRequest.bodyJsonUnsafe({ model_id: MODEL, text })
          ),
          // Audio comes as Base64 in JSON, a third larger, with its timing.
          { limit: 16 * 1024 * 1024, timeout: "3 minutes" }
        ).pipe(Effect.provideService(HttpClient.HttpClient, client));
        const { alignment, audio_base64: encoded } = yield* decodeJson(Timed)(
          body,
          unavailable
        );
        const audio = fromBase64(encoded);
        if (audio.byteLength === 0 || audio.byteLength > 8 * 1024 * 1024) {
          return yield* unavailable();
        }
        const starts = timeCharacters(
          text,
          alignment?.characters ?? [],
          alignment?.character_start_times_seconds ?? []
        );
        yield* Effect.annotateCurrentSpan({
          "voice.audio_bytes": audio.byteLength,
          ...observationOutput({ audioBytes: audio.byteLength }),
        });
        return { audio, starts };
      });
      return { speak };
    })
  );
}
