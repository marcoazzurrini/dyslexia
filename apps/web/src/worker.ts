import { API_PATH, handleNarrations } from "@dyslexia/narrations";
import type { NarrationsEnv } from "@dyslexia/narrations";
import serverEntry from "@tanstack/react-start/server-entry";

import type { AuthEnv } from "./server/auth";

export { NarrationWorkflow } from "@dyslexia/narrations";

type Env = AuthEnv & NarrationsEnv;

// Cloudflare limits Worker startup time, so heavy server code (Effect,
// Better Auth) loads on the first request that needs it.
export default {
  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/auth/")) {
      const { authFor } = await import("./server/auth");
      return (
        (await authFor(env)?.handle(request)) ??
        new Response("Sign-in is not configured", { status: 503 })
      );
    }
    if (pathname === "/api/session") {
      const { session } = await import("./server/session");
      return session(request, env);
    }
    if (pathname === API_PATH || pathname.startsWith(`${API_PATH}/`)) {
      return handleNarrations(request, env, {
        isSignedIn: async (signedRequest) => {
          const auth = await import("./server/auth");
          return auth.isSignedIn(env, signedRequest);
        },
      });
    }
    // Existing static files are served before this handler. Never return the
    // SPA document for a missing icon or bundled asset.
    if (/^\/(?:icons|assets)\//u.test(pathname)) {
      return new Response("Not found", { status: 404 });
    }
    return serverEntry.fetch(request);
  },
};
