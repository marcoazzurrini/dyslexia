import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { serveAudio } from "../server/audio-response";

export const Route = createFileRoute("/audio/$filename")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        serveAudio(request, params.filename, env.AUDIO),
      HEAD: ({ request, params }) =>
        serveAudio(request, params.filename, env.AUDIO),
    },
  },
});
