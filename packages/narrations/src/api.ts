import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiMiddleware,
} from "effect/http-api";

import {
  CouldNotStart,
  InvalidLink,
  NarrationNotFound,
  NotConfigured,
  TooManyInProgress,
  WrongState,
} from "./errors.ts";
import { NarrationSchema } from "./narration.ts";

/**
 * Lets a request through only when the service is configured, the person is
 * signed in, and a change comes from this site.
 */
export class Guard extends HttpApiMiddleware.Service<Guard>()(
  "narrations/Guard",
  {
    error: [HttpApiError.Unauthorized, HttpApiError.Forbidden, NotConfigured],
  }
) {}

const params = { id: Schema.String };

/** The narrations API, shared by the server and the browser client. */
export const NarrationsApi = HttpApi.make("narrations")
  .add(
    HttpApiGroup.make("narrations", { topLevel: true })
      .add(
        HttpApiEndpoint.get("list", "/", {
          success: Schema.Array(NarrationSchema),
        })
      )
      .add(
        HttpApiEndpoint.post("start", "/", {
          error: [InvalidLink, TooManyInProgress, CouldNotStart],
          payload: Schema.Struct({ url: Schema.String }),
          success: NarrationSchema,
        })
      )
      .add(
        HttpApiEndpoint.post("retry", "/:id/retry", {
          error: [
            NarrationNotFound,
            WrongState,
            TooManyInProgress,
            CouldNotStart,
          ],
          params,
          success: NarrationSchema,
        })
      )
      .add(
        HttpApiEndpoint.delete("remove", "/:id", {
          error: [NarrationNotFound, WrongState],
          params,
        })
      )
      .add(
        HttpApiEndpoint.get("audio", "/:id/audio", {
          error: NarrationNotFound,
          params,
        })
      )
      .middleware(Guard)
  )
  .prefix("/api/narrations");
