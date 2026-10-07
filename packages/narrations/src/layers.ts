import { ConfigProvider, Layer } from "effect";
import { FetchHttpClient } from "effect/http";

import type { NarrationsEnv } from "./config.ts";
import { Engine } from "./services/engine.ts";
import { Reader } from "./services/reader.ts";
import { Store } from "./services/store.ts";
import { Voice } from "./services/voice.ts";
import { Writer } from "./services/writer.ts";

/** Storage and the background runner, from the Worker's bindings. */
export const storageFor = (env: NarrationsEnv) =>
  Layer.mergeAll(Store.layer(env.AUDIO), Engine.layer(env.NARRATION));

type Secrets = Pick<
  NarrationsEnv,
  "ELEVENLABS_API_KEY" | "FIRECRAWL_API_KEY" | "OPENROUTER_API_KEY"
>;

const secretsOf = (env: Secrets) => {
  const secrets: Record<string, string> = {};
  for (const name of [
    "ELEVENLABS_API_KEY",
    "FIRECRAWL_API_KEY",
    "OPENROUTER_API_KEY",
  ] as const) {
    const value = env[name];
    if (value) {
      secrets[name] = value;
    }
  }
  return secrets;
};

/** The outside services, with keys read from the Worker's secrets. */
export const servicesFor = (env: Secrets) =>
  Layer.mergeAll(Reader.layer, Writer.layer, Voice.layer).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(
      ConfigProvider.layer(ConfigProvider.fromEnv({ env: secretsOf(env) }))
    )
  );
