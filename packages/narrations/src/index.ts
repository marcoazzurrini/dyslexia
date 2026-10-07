/**
 * Narrations: paste an article link, get back the article read aloud.
 *
 * The Worker serves the API with `handleNarrations` and exports
 * `NarrationWorkflow`, which makes each narration in the background. The
 * browser talks to the API through `@dyslexia/narrations/client`.
 */
import type { NarrationsEnv } from "./config.ts";
import type { Access } from "./server.ts";

export { NarrationWorkflow } from "./cloudflare.ts";
export { API_PATH, isConfigured } from "./config.ts";
export type { NarrationsEnv } from "./config.ts";
export type { Access } from "./server.ts";

/**
 * Serves a request under `API_PATH`, for people `access` lets in. Changes
 * must also come from the same site.
 */
export const handleNarrations = async (
  request: Request,
  env: NarrationsEnv,
  access: Access
): Promise<Response> => {
  // Loaded on first use to keep Worker startup within Cloudflare's limit.
  const server = await import("./server.ts");
  return server.handleNarrations(request, env, access);
};
