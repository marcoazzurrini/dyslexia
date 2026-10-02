import { createServer } from "node:http";

import {
  assemble,
  AssemblyError,
  MAX_BODY_BYTES,
  REQUEST_TIMEOUT_MS,
} from "./assembly.mjs";

export const readJsonBody = (request, signal) => {
  const contentType = request.headers["content-type"]
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (
    contentType !== "application/json" ||
    (request.headers["content-encoding"] &&
      request.headers["content-encoding"] !== "identity")
  ) {
    return Promise.reject(new AssemblyError("expected_json", 415));
  }
  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined && Number(contentLength) > MAX_BODY_BYTES) {
    return Promise.reject(new AssemblyError("request_too_large", 413));
  }
  const { promise, resolve, reject } = Promise.withResolvers();
  const chunks = [];
  let bytes = 0;
  const handlers = {
    cleanup() {
      request.off("data", handlers.onData);
      request.off("end", handlers.onEnd);
      request.off("error", handlers.onError);
      signal.removeEventListener("abort", handlers.onAbort);
    },
    fail(error) {
      handlers.cleanup();
      request.pause();
      reject(error);
    },
    onAbort() {
      handlers.fail(signal.reason);
    },
    onData(chunk) {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        handlers.fail(new AssemblyError("request_too_large", 413));
      } else {
        chunks.push(chunk);
      }
    },
    onEnd() {
      handlers.cleanup();
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(new AssemblyError("invalid_json", 400));
      }
    },
    onError() {
      handlers.fail(new AssemblyError("invalid_request", 400));
    },
  };
  request.on("data", handlers.onData);
  request.once("end", handlers.onEnd);
  request.once("error", handlers.onError);
  signal.addEventListener("abort", handlers.onAbort, { once: true });
  if (signal.aborted) {
    handlers.onAbort();
  }
  return promise;
};

export const sendJson = (response, status, value, close = false) => {
  if (response.destroyed) {
    return;
  }
  const body = JSON.stringify(value);
  const headers = {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json",
  };
  if (close) {
    headers.Connection = "close";
  }
  response.writeHead(status, headers);
  response.end(body);
};

export const createAssemblyServer = ({
  allowLocal = process.env.ALLOW_LOCAL_ASSEMBLY === "true",
  assembleJob = assemble,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) => {
  let busy = false;
  const server = createServer(
    {
      headersTimeout: Math.min(10_000, requestTimeoutMs),
      maxHeaderSize: 8192,
      requestTimeout: requestTimeoutMs,
    },
    async (request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, { ok: true });
        return;
      }
      if (request.url !== "/assemble") {
        sendJson(response, 404, { error: "not_found" }, true);
        return;
      }
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        sendJson(response, 405, { error: "method_not_allowed" }, true);
        return;
      }
      if (busy) {
        sendJson(response, 409, { error: "busy" }, true);
        return;
      }
      // Lock before reading the body. Do not queue or run duplicate jobs concurrently.
      busy = true;
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(new AssemblyError("request_timeout", 504));
      }, requestTimeoutMs);
      const onDisconnect = () => {
        if (!response.writableFinished) {
          controller.abort(new AssemblyError("request_aborted", 408));
        }
      };
      request.once("aborted", onDisconnect);
      response.once("close", onDisconnect);
      try {
        const input = await readJsonBody(request, controller.signal);
        const result = await assembleJob(input, {
          allowLocal,
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        sendJson(response, 200, result);
      } catch (error) {
        const failure = controller.signal.aborted
          ? controller.signal.reason
          : error;
        const known = failure instanceof AssemblyError;
        sendJson(
          response,
          known ? failure.status : 500,
          {
            error: known ? failure.code : "assembly_failed",
          },
          true
        );
      } finally {
        clearTimeout(timer);
        request.off("aborted", onDisconnect);
        response.off("close", onDisconnect);
        busy = false;
      }
    }
  );
  server.keepAliveTimeout = 5000;
  return server;
};

export const startServer = () => {
  const server = createAssemblyServer();
  server.listen(8080, "0.0.0.0");
  return server;
};

if (import.meta.main) {
  startServer();
}
