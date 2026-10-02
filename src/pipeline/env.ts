import type {
  DurableObjectNamespace,
  R2Bucket,
  Workflow,
} from "@cloudflare/workers-types";

export interface PipelineParameters {
  jobId: string;
  origin: string;
}

export interface PipelineEnv {
  AUDIO: R2Bucket;
  NARRATION: Workflow<PipelineParameters>;
  ASSEMBLER: DurableObjectNamespace;
  PIPELINE_ACCESS_TOKEN?: string;
  PIPELINE_SIGNING_SECRET?: string;
  PIPELINE_LOGIN_LIMIT?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
  FIRECRAWL_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
}
