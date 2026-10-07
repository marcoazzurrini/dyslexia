import { isConfigured } from "@dyslexia/narrations";
import type { NarrationsEnv } from "@dyslexia/narrations";

import { authFor, isSignedIn } from "./auth";
import type { AuthEnv } from "./auth";

/** Whether sign-in and narrations are set up, and whether the visitor is signed in. */
export const session = async (
  request: Request,
  env: AuthEnv & NarrationsEnv
) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      headers: { Allow: "GET" },
      status: 405,
    });
  }
  return Response.json(
    {
      authenticated: await isSignedIn(env, request),
      configured: Boolean(authFor(env)) && isConfigured(env),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
};
