import serverEntry from "@tanstack/react-start/server-entry";

import type { PipelineEnv } from "./pipeline/env";

export { NarrationWorkflow } from "./pipeline/cloudflare";

// Cloudflare limits Worker startup time, so heavy server code (provider SDKs,
// Effect, Better Auth) loads on the first request that needs it.
export default {
  async fetch(request: Request, env: PipelineEnv) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/auth/")) {
      const { authFor } = await import("./pipeline/auth");
      return (
        (await authFor(env)?.handle(request)) ??
        new Response("Sign-in is not configured", { status: 503 })
      );
    }
    if (pathname.startsWith("/api/pipeline/")) {
      const { pipelineApi } = await import("./pipeline/api");
      return pipelineApi(request, env);
    }
    // Existing static files are served before this handler. Never return the
    // SPA document for a missing icon or bundled asset.
    if (/^\/(?:icons|assets)\//u.test(pathname)) {
      return new Response("Not found", { status: 404 });
    }
    return serverEntry.fetch(request);
  },
};
