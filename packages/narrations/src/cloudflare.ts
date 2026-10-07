// The Workers runtime module has no package to import types from, and apps
// that import this package need its declaration too.
// eslint-disable-next-line typescript/triple-slash-reference -- See above.
/// <reference path="./cloudflare-workers.d.ts" />
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import type { NarrationsEnv } from "./config.ts";
import type { NarrationParams } from "./services/engine.ts";

/** The Cloudflare Workflow that makes narrations. Export it from the Worker. */
export class NarrationWorkflow extends WorkflowEntrypoint<
  NarrationsEnv,
  NarrationParams
> {
  async run(event: WorkflowEvent<NarrationParams>, step: WorkflowStep) {
    // Loaded on first use to keep Worker startup within Cloudflare's limit.
    const { makeNarration, runtimeFor } = await import("./workflow.ts");
    const runtime = runtimeFor(this.env);
    try {
      await makeNarration(event.payload.id, step, runtime);
    } finally {
      await runtime.dispose();
    }
  }
}
