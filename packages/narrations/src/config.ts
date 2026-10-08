import type { R2Bucket, Workflow } from "@cloudflare/workers-types";

import type { NarrationParams } from "./services/engine.ts";
import type { LangfuseEnv } from "./telemetry.ts";

/**
 * The Worker bindings and secrets narrations need. Without the Langfuse
 * settings, narration runs are not traced.
 */
export interface NarrationsEnv extends LangfuseEnv {
  /** Narrations and their audio. */
  readonly AUDIO: R2Bucket;
  /** The Cloudflare Workflow that makes narrations. */
  readonly NARRATION: Workflow<NarrationParams>;
  readonly FIRECRAWL_API_KEY?: string;
  readonly OPENROUTER_API_KEY?: string;
  readonly ELEVENLABS_API_KEY?: string;
  /** Optional. Without it, API requests are not traced. */
  readonly HONEYCOMB_API_KEY?: string;
}

/** Whether every service key is set. */
export const isConfigured = (env: NarrationsEnv) =>
  [env.FIRECRAWL_API_KEY, env.OPENROUTER_API_KEY, env.ELEVENLABS_API_KEY].every(
    (key) => Boolean(key?.trim())
  );

/** Where the narrations API is served. */
export const API_PATH = "/api/narrations";
