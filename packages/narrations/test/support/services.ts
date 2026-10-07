import { Effect } from "effect";

import { Reader } from "../../src/services/reader.ts";
import { Store } from "../../src/services/store.ts";
import { Voice } from "../../src/services/voice.ts";
import { Writer } from "../../src/services/writer.ts";

// Run an effect with one service, as Service.use does.

export const withStore = <A, E>(
  program: (store: Store["Service"]) => Effect.Effect<A, E>
) =>
  Effect.gen(function* body() {
    return yield* program(yield* Store);
  });

export const withReader = <A, E>(
  program: (reader: Reader["Service"]) => Effect.Effect<A, E>
) =>
  Effect.gen(function* body() {
    return yield* program(yield* Reader);
  });

export const withWriter = <A, E>(
  program: (writer: Writer["Service"]) => Effect.Effect<A, E>
) =>
  Effect.gen(function* body() {
    return yield* program(yield* Writer);
  });

export const withVoice = <A, E>(
  program: (voice: Voice["Service"]) => Effect.Effect<A, E>
) =>
  Effect.gen(function* body() {
    return yield* program(yield* Voice);
  });
