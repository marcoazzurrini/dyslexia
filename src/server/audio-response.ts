import type { R2Bucket, R2Object } from "@cloudflare/workers-types";

import { ARTICLE } from "../lib/article.ts";

const AUDIO_KEY = ARTICLE.audioUrl.slice("/audio/".length);

interface ByteRange {
  offset: number;
  length: number;
}

// Ignore malformed or multipart ranges; return null for unsatisfiable ranges.
const parseRange = (
  value: string,
  size: number
): ByteRange | null | undefined => {
  const groups = /^bytes=(?<start>\d*)-(?<end>\d*)$/u.exec(
    value.trim()
  )?.groups;
  if (!groups || (!groups.start && !groups.end)) {
    return;
  }
  const start = groups.start ? Number(groups.start) : undefined;
  const end = groups.end ? Number(groups.end) : undefined;
  if (
    (start !== undefined && !Number.isSafeInteger(start)) ||
    (end !== undefined && !Number.isSafeInteger(end))
  ) {
    return;
  }
  if (size === 0) {
    return null;
  }
  if (start === undefined) {
    if (!end) {
      return null;
    }
    const length = Math.min(end, size);
    return { length, offset: size - length };
  }
  if (start >= size || (end !== undefined && end < start)) {
    return null;
  }
  return {
    length: Math.min(end ?? size - 1, size - 1) - start + 1,
    offset: start,
  };
};

const matchesEtag = (value: string | null, etag: string) =>
  value?.split(",").some((part) => {
    const tag = part.trim();
    return tag === "*" || tag.replace(/^W\//u, "") === etag;
  }) ?? false;

const matchesIfRange = (value: string | null, object: R2Object) => {
  if (!value || value === object.httpEtag) {
    return true;
  }
  if (value.startsWith('"') || value.startsWith("W/")) {
    return false;
  }
  const date = Date.parse(value);
  return (
    Number.isFinite(date) &&
    Math.floor(object.uploaded.getTime() / 1000) <= date / 1000
  );
};

export const serveAudio = async (
  request: Request,
  filename: string,
  bucket: Pick<R2Bucket, "get" | "head">
): Promise<Response> => {
  if (filename !== AUDIO_KEY) {
    return new Response("Recording not found", { status: 404 });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      headers: { Allow: "GET, HEAD" },
      status: 405,
    });
  }

  const object = await bucket.head(AUDIO_KEY);
  if (!object) {
    return new Response("Recording is not available yet", {
      headers: { "Cache-Control": "no-store" },
      status: 404,
    });
  }
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    // The app currently has no authentication. This prevents shared caching;
    // it does not make the recording private or authorize the caller.
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": "inline",
    "Content-Type": "audio/mpeg",
    ETag: object.httpEtag,
    "Last-Modified": object.uploaded.toUTCString(),
    "X-Content-Type-Options": "nosniff",
  });
  if (matchesEtag(request.headers.get("If-None-Match"), object.httpEtag)) {
    return new Response(null, { headers, status: 304 });
  }

  const rangeHeader = request.headers.get("Range");
  const range =
    request.method === "GET" &&
    rangeHeader &&
    matchesIfRange(request.headers.get("If-Range"), object)
      ? parseRange(rangeHeader, object.size)
      : undefined;
  if (range === null) {
    headers.set("Content-Range", `bytes */${object.size}`);
    return new Response(null, { headers, status: 416 });
  }
  headers.set("Content-Length", String(range?.length ?? object.size));
  if (request.method === "HEAD") {
    return new Response(null, { headers });
  }

  const result = await bucket.get(AUDIO_KEY, {
    onlyIf: { etagMatches: object.etag },
    range,
  });
  if (!result || !("body" in result)) {
    return new Response("Recording changed; please retry", {
      headers: { "Cache-Control": "no-store" },
      status: 503,
    });
  }
  if (range) {
    headers.set(
      "Content-Range",
      `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`
    );
  }
  // Check the runtime boundary between Cloudflare's standalone declarations
  // and the DOM types used by the rest of the app; never buffer the recording.
  if (!(result.body instanceof ReadableStream)) {
    throw new TypeError("R2 did not return a readable stream");
  }
  return new Response(result.body, {
    headers,
    status: range ? 206 : 200,
  });
};
