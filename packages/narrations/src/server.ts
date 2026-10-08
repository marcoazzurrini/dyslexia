import { Effect, Layer, ManagedRuntime } from "effect";
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { Guard, NarrationsApi } from "./api.ts";
import { isConfigured } from "./config.ts";
import type { NarrationsEnv } from "./config.ts";
import { NotConfigured } from "./errors.ts";
import { storageFor } from "./layers.ts";
import { audio, list, present, remove, retry, start } from "./library.ts";
import type { Engine } from "./services/engine.ts";
import type { Store } from "./services/store.ts";
import { flushTraces, tracingFor } from "./telemetry.ts";

export interface Access {
  /** Whether the request comes from someone allowed to use narrations. */
  readonly isSignedIn: (request: Request) => Promise<boolean>;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const guardFor = (env: NarrationsEnv, access: Access) =>
  Layer.succeed(Guard)((endpoint) =>
    Effect.gen(function* guard() {
      if (!isConfigured(env)) {
        return yield* new NotConfigured();
      }
      const { method, source } = yield* HttpServerRequest.HttpServerRequest;
      if (!(source instanceof Request)) {
        return yield* Effect.die(new TypeError("Expected a Fetch request"));
      }
      if (!(yield* Effect.promise(() => access.isSignedIn(source)))) {
        return yield* new HttpApiError.Unauthorized();
      }
      // A change must come from this site, or another site could spend
      // credit on behalf of whoever is signed in.
      if (
        !SAFE_METHODS.has(method) &&
        source.headers.get("Origin") !== new URL(source.url).origin
      ) {
        return yield* new HttpApiError.Forbidden();
      }
      return yield* endpoint;
    })
  );

const Handlers = HttpApiBuilder.group(NarrationsApi, "narrations", (handlers) =>
  Effect.gen(function* buildHandlers() {
    const services = yield* Effect.context<Store | Engine>();
    const serve = <A, E>(effect: Effect.Effect<A, E, Store | Engine>) =>
      Effect.provide(effect, services);
    return handlers
      .handle("list", () =>
        serve(list).pipe(Effect.map((all) => all.map(present)))
      )
      .handle("start", ({ payload }) =>
        serve(start(payload.url)).pipe(Effect.map(present))
      )
      .handle("retry", ({ params }) =>
        serve(retry(params.id)).pipe(Effect.map(present))
      )
      .handle("remove", ({ params }) => serve(remove(params.id)))
      .handle("audio", ({ params, request }) =>
        request.source instanceof Request
          ? serve(audio(params.id, request.source)).pipe(
              Effect.map(HttpServerResponse.fromWeb)
            )
          : Effect.die(new TypeError("Expected a Fetch request"))
      );
  })
);

interface Api {
  readonly handler: (request: Request) => Promise<Response>;
  readonly flush: () => Promise<void>;
}

const apis = new WeakMap<NarrationsEnv, Api>();

const apiFor = (env: NarrationsEnv, access: Access): Api => {
  // The API and `flush` share one tracer, built once.
  const tracing = tracingFor(env);
  const memoMap = Layer.makeMemoMapUnsafe();
  const telemetry = ManagedRuntime.make(tracing, { memoMap });
  const { handler } = HttpRouter.toWebHandler(
    HttpApiBuilder.layer(NarrationsApi).pipe(
      Layer.provide(Handlers),
      Layer.provide(guardFor(env, access)),
      Layer.provide(storageFor(env)),
      Layer.provide(HttpServer.layerServices),
      Layer.provideMerge(tracing)
    ),
    { disableLogger: true, memoMap }
  );
  return { flush: () => telemetry.runPromise(flushTraces), handler };
};

/**
 * Serves the narrations API. A Worker reuses one env object across requests,
 * so the API is built once per env, with the first `access` given for it.
 * Traces are sent after the answer, through `waitUntil`.
 */
export const handleNarrations = async (
  request: Request,
  env: NarrationsEnv,
  access: Access,
  waitUntil: (promise: Promise<unknown>) => void
) => {
  let api = apis.get(env);
  if (!api) {
    api = apiFor(env, access);
    apis.set(env, api);
  }
  const response = await api.handler(request);
  waitUntil(api.flush());
  return response;
};
