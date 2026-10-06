import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import type { PipelineEnv, PipelineParameters } from "./env";
import { runPipeline } from "./run";

export class NarrationWorkflow extends WorkflowEntrypoint<
  PipelineEnv,
  PipelineParameters
> {
  run(event: WorkflowEvent<PipelineParameters>, step: WorkflowStep) {
    return runPipeline(this.env, event.payload, step);
  }
}
