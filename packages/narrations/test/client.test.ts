import "./support/workers.ts";
import { describe, expect, test } from "bun:test";

import {
  listNarrations,
  NarrationsError,
  removeNarration,
  retryNarration,
  startNarration,
} from "../src/client.ts";
import { MAX_IN_PROGRESS } from "../src/limits.ts";
import { apiSetup, ORIGIN } from "./support/api.ts";
import { routeFetch } from "./support/network.ts";

/** Sends the client's requests to `server`, as a browser on this site would. */
const serve = (server: (request: Request) => Promise<Response>) => {
  routeFetch((request) => {
    // Browsers add Origin to requests that change something.
    if (request.method !== "GET") {
      request.headers.set("Origin", ORIGIN);
    }
    return server(request);
  });
};

const failure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the request to fail");
};

describe("the narrations client", () => {
  test("starts, lists, retries, and removes narrations", async () => {
    const api = apiSetup();
    serve(api.handle);
    const started = await startNarration("https://example.org/article");
    expect(started).toMatchObject({
      state: "making",
      url: "https://example.org/article",
    });
    expect(await listNarrations()).toEqual([started]);

    const failed = await api.seed({ reason: "No.", state: "failed" });
    const retried = await retryNarration(failed.id);
    expect(retried).toMatchObject({ state: "making", url: failed.url });

    const ready = await api.seed({
      durationSeconds: 60,
      state: "ready",
      title: "Done",
    });
    const listed = await listNarrations();
    expect(listed[0]).toMatchObject({
      audioUrl: `/api/narrations/${ready.id}/audio`,
      id: ready.id,
    });
    await removeNarration(ready.id);
    const remaining = await listNarrations();
    expect(remaining.map((narration) => narration.id)).not.toContain(ready.id);
  });

  test.each([
    ["signed-out", "Your session ended. Sign in again."],
    ["invalid-link", "Use a public link that starts with https://."],
  ] as const)("explains a %s failure", async (kind, message) => {
    const api = apiSetup();
    api.access.signedIn = kind !== "signed-out";
    serve(api.handle);
    const error = await failure(startNarration("http://localhost/a"));
    expect(error).toBeInstanceOf(NarrationsError);
    expect(error).toMatchObject({ kind, message });
  });

  test("explains that too many narrations are being made", async () => {
    const api = apiSetup();
    for (let index = 0; index < MAX_IN_PROGRESS; index += 1) {
      // eslint-disable-next-line no-await-in-loop -- Seed one after another.
      await api.seed({ stage: "reading", state: "making" }, { running: true });
    }
    serve(api.handle);
    expect(
      await failure(startNarration("https://example.org/a"))
    ).toMatchObject({ kind: "busy" });
  });

  test("explains a narration that is gone or still being made", async () => {
    const api = apiSetup();
    const making = await api.seed(
      { stage: "reading", state: "making" },
      { running: true }
    );
    serve(api.handle);
    expect(
      await failure(removeNarration("0000000000000-00000000"))
    ).toMatchObject({
      kind: "not-found",
    });
    expect(await failure(removeNarration(making.id))).toMatchObject({
      kind: "conflict",
    });
  });

  test.each([
    [
      "the server is not set up",
      () => apiSetup({ keys: { FIRECRAWL_API_KEY: "" } }).handle,
    ],
    [
      "the network is down",
      () => () => Promise.reject(new TypeError("offline")),
    ],
    [
      "the server fails",
      () => () => Promise.resolve(new Response("<html>", { status: 500 })),
    ],
    [
      "the answer is not what the client expects",
      () => () => Promise.resolve(Response.json([{ id: 1 }])),
    ],
  ])("reports the service unavailable when %s", async (_case, handler) => {
    serve(handler());
    const error = await failure(listNarrations());
    expect(error).toBeInstanceOf(NarrationsError);
    expect(error).toMatchObject({ kind: "unavailable" });
  });

  test("stops when the caller cancels", async () => {
    serve(() => Promise.withResolvers<Response>().promise);
    const controller = new AbortController();
    const listing = listNarrations(controller.signal);
    controller.abort();
    await expect(listing).rejects.toBeDefined();
  });
});
