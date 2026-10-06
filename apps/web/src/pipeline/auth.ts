import { createAuth } from "@dyslexia/auth";
import type { Auth } from "@dyslexia/auth";

import type { PipelineEnv } from "./env.ts";

// A Worker reuses one env object across requests, so build auth once per env.
const cache = new WeakMap<PipelineEnv, Auth | undefined>();

/** Google sign-in for this app, or `undefined` until it is configured. */
export const authFor = (env: PipelineEnv) => {
  if (cache.has(env)) {
    return cache.get(env);
  }
  const {
    AUTH_ALLOWED_EMAILS,
    BETTER_AUTH_SECRET,
    BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  } = env;
  const auth =
    AUTH_ALLOWED_EMAILS &&
    BETTER_AUTH_SECRET &&
    BETTER_AUTH_URL &&
    GOOGLE_CLIENT_ID &&
    GOOGLE_CLIENT_SECRET
      ? createAuth({
          allowedEmails: AUTH_ALLOWED_EMAILS.split(","),
          baseUrl: BETTER_AUTH_URL,
          google: {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
          },
          secret: BETTER_AUTH_SECRET,
        })
      : undefined;
  cache.set(env, auth);
  return auth;
};

export const sameOrigin = (request: Request) =>
  request.headers.get("Origin") === new URL(request.url).origin;
