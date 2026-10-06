import type { R2Bucket, Workflow } from "@cloudflare/workers-types";

export interface PipelineParameters {
  jobId: string;
}

export interface PipelineEnv {
  AUDIO: R2Bucket;
  NARRATION: Workflow<PipelineParameters>;
  AUTH_ALLOWED_EMAILS?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  FIRECRAWL_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
}
