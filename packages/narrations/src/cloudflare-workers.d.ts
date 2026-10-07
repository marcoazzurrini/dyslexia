declare module "cloudflare:workers" {
  import type { CloudflareWorkersModule } from "@cloudflare/workers-types";

  export const WorkflowEntrypoint: typeof CloudflareWorkersModule.WorkflowEntrypoint;
  export type WorkflowEvent<T> = CloudflareWorkersModule.WorkflowEvent<T>;
  export type WorkflowStep = CloudflareWorkersModule.WorkflowStep;
  export type WorkflowStepConfig = CloudflareWorkersModule.WorkflowStepConfig;
}
