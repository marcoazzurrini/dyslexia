import serverEntry from "@tanstack/react-start/server-entry";

import { pipelineApi } from "./pipeline/api";
import { authFor } from "./pipeline/auth";
import type { PipelineEnv } from "./pipeline/env";

export { NarrationWorkflow } from "./pipeline/cloudflare";

export default {
  async fetch(request: Request, env: PipelineEnv) {
    const signIn = await authFor(env)?.handle(request);
    if (signIn) {
      return signIn;
    }
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/pipeline/")) {
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
