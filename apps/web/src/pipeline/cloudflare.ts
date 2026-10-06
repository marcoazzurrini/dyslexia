import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import type { PipelineEnv, PipelineParameters } from "./env";

export class NarrationWorkflow extends WorkflowEntrypoint<
  PipelineEnv,
  PipelineParameters
> {
  // Loaded on demand to keep Worker startup within Cloudflare's limit.
  async run(event: WorkflowEvent<PipelineParameters>, step: WorkflowStep) {
    const { runPipeline } = await import("./run");
    return runPipeline(this.env, event.payload, step);
  }
}
