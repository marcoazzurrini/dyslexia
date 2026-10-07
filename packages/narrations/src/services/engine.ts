import type { Workflow } from "@cloudflare/workers-types";
import { Context, Effect, Layer } from "effect";

import { CouldNotStart } from "../errors.ts";

export interface NarrationParams {
  readonly id: string;
}

// Every status of a Cloudflare Workflow instance that may still finish.
const ALIVE = new Set([
  "queued",
  "running",
  "paused",
  "waiting",
  "waitingForPause",
]);

/** Runs the steps that make a narration, durably, in the background. */
export class Engine extends Context.Service<
  Engine,
  {
    readonly start: (id: string) => Effect.Effect<void, CouldNotStart>;
    /** Whether the narration's run may still finish. */
    readonly isRunning: (id: string) => Effect.Effect<boolean>;
  }
>()("narrations/Engine") {
  /** Runs on Cloudflare Workflows; the instance id is the narration id. */
  static readonly layer = (workflow: Workflow<NarrationParams>) =>
    Layer.succeed(Engine, {
      isRunning: (id) =>
        Effect.promise(async () => {
          try {
            const instance = await workflow.get(id);
            const { status } = await instance.status();
            return ALIVE.has(status);
          } catch {
            // Cloudflare has no run with this id.
            return false;
          }
        }),
      start: (id) =>
        Effect.tryPromise({
          catch: () => new CouldNotStart(),
          try: () => workflow.create({ id, params: { id } }),
        }).pipe(Effect.asVoid),
    });
}
