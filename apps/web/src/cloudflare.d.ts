declare module "cloudflare:workers" {
  import type { CloudflareWorkersModule } from "@cloudflare/workers-types";

  import type { PipelineEnv } from "./pipeline/env";

  const env: PipelineEnv;
  export { env };
  export const WorkflowEntrypoint: typeof CloudflareWorkersModule.WorkflowEntrypoint;
  export type WorkflowEvent<T> = CloudflareWorkersModule.WorkflowEvent<T>;
  export type WorkflowStep = CloudflareWorkersModule.WorkflowStep;
}
