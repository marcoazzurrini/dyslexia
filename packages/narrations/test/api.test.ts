import "./support/workers.ts";
import { describe, expect, test } from "bun:test";

import { INTERRUPTED } from "../src/errors.ts";
import { MAX_IN_PROGRESS } from "../src/limits.ts";
import { apiSetup, ORIGIN } from "./support/api.ts";
import { speech } from "./support/audio.ts";

const LONG_AGO = "2020-01-01T00:00:00.000Z";

describe("who may use the API", () => {
  test("nobody, until every service key is set", async () => {
    const api = apiSetup({ keys: { OPENROUTER_API_KEY: " " } });
    const response = await api.call("GET");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ _tag: "NotConfigured" });
  });

  test("not someone signed out", async () => {
    const api = apiSetup();
    api.access.signedIn = false;
    for (const response of [
      await api.call("GET"),
      await api.call("POST", "", { body: { url: "https://example.org/a" } }),
    ]) {
      expect(response.status).toBe(401);
    }
    expect(api.keys()).toEqual([]);
  });

  test("not another site, for a change", async () => {
    const api = apiSetup();
    const elsewhere = await api.call("POST", "", {
      body: { url: "https://example.org/a" },
      headers: { Origin: "https://evil.example" },
    });
    expect(elsewhere.status).toBe(403);
    const unknown = await api.handle(
      new Request(`${ORIGIN}/api/narrations`, {
        body: JSON.stringify({ url: "https://example.org/a" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );
    expect(unknown.status).toBe(403);
    expect(api.keys()).toEqual([]);
  });

  test("anyone signed in, to read, from any page", async () => {
    const api = apiSetup();
    const response = await api.handle(new Request(`${ORIGIN}/api/narrations`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe("listing", () => {
  test("shows each narration with where to play it when ready", async () => {
    const api = apiSetup();
    const failed = await api.seed({ reason: "Nope.", state: "failed" });
    const ready = await api.seed({
      durationSeconds: 1,
      state: "ready",
      title: "Done",
    });
    const making = await api.seed(
      { stage: "writing", state: "making" },
      { running: true }
    );
    const response = await api.call("GET");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      making,
      { ...ready, audioUrl: `/api/narrations/${ready.id}/audio` },
      failed,
    ]);
  });

  test("finishes the cleanup of a run that stopped without it", async () => {
    const api = apiSetup();
    const stopped = await api.seed({
      createdAt: LONG_AGO,
      stage: "recording",
      state: "making",
    });
    api.workflow.statuses.set(stopped.id, "errored");
    const gone = await api.seed({
      createdAt: LONG_AGO,
      stage: "reading",
      state: "making",
    });
    const [second, first] = await api.listed();
    expect(first).toMatchObject({
      id: stopped.id,
      reason: INTERRUPTED,
      state: "failed",
    });
    expect(second).toMatchObject({
      id: gone.id,
      reason: INTERRUPTED,
      state: "failed",
    });
    expect(api.keys()).toEqual(
      [
        `narrations/${stopped.id}/narration.json`,
        `narrations/${gone.id}/narration.json`,
      ].toSorted()
    );
  });

  test("leaves runs that are going, or just starting", async () => {
    const api = apiSetup();
    const running = await api.seed(
      { createdAt: LONG_AGO, stage: "recording", state: "making" },
      { running: true }
    );
    // Saved a moment ago; its run may not be created yet.
    const starting = await api.seed({ stage: "reading", state: "making" });
    const listed = await api.listed();
    expect(
      listed.map((narration: { state: string }) => narration.state)
    ).toEqual(["making", "making"]);
    expect(
      listed.map((narration: { id: string }) => narration.id).toSorted()
    ).toEqual([running.id, starting.id].toSorted());
  });
});

describe("starting a narration", () => {
  test("saves it and starts its run", async () => {
    const api = apiSetup();
    const response = await api.call("POST", "", {
      body: { url: "https://www.example.org/article#top" },
    });
    expect(response.status).toBe(200);
    const narration = await response.json();
    expect(narration).toMatchObject({
      stage: "reading",
      state: "making",
      title: "example.org",
      url: "https://www.example.org/article",
    });
    expect(api.workflow.statuses.get(narration.id)).toBe("running");
    expect(await api.listed()).toEqual([narration]);
  });

  test("refuses a link that is not a public HTTPS address", async () => {
    const api = apiSetup();
    const response = await api.call("POST", "", {
      body: { url: "http://localhost/a" },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ _tag: "InvalidLink" });
    expect(api.keys()).toEqual([]);
  });

  test("refuses a request without a link", async () => {
    const api = apiSetup();
    expect(
      await api.status("POST", "", { body: { link: "https://example.org" } })
    ).toBe(400);
  });

  test(`allows ${MAX_IN_PROGRESS} at once`, async () => {
    const api = apiSetup();
    for (let index = 0; index < MAX_IN_PROGRESS; index += 1) {
      // eslint-disable-next-line no-await-in-loop -- Seed one after another.
      await api.seed({ stage: "reading", state: "making" }, { running: true });
    }
    const response = await api.call("POST", "", {
      body: { url: "https://example.org/a" },
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ _tag: "TooManyInProgress" });
  });

  test("counts only narrations in progress toward the limit", async () => {
    const api = apiSetup();
    for (let index = 0; index < MAX_IN_PROGRESS; index += 1) {
      // eslint-disable-next-line no-await-in-loop -- Seed one after another.
      await api.seed({ reason: "No.", state: "failed" });
    }
    const response = await api.call("POST", "", {
      body: { url: "https://example.org/a" },
    });
    expect(response.status).toBe(200);
  });

  test("leaves nothing behind when Cloudflare does not start the run", async () => {
    const api = apiSetup({ failCreate: true });
    const response = await api.call("POST", "", {
      body: { url: "https://example.org/a" },
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ _tag: "CouldNotStart" });
    expect(api.keys()).toEqual([]);
  });
});

describe("trying again", () => {
  test("replaces a failed narration with a new one for the same link", async () => {
    const api = apiSetup();
    const failed = await api.seed({
      reason: "No.",
      state: "failed",
      url: "https://example.org/x",
    });
    const response = await api.call("POST", `/${failed.id}/retry`);
    expect(response.status).toBe(200);
    const next = await response.json();
    expect(next).toMatchObject({
      state: "making",
      url: "https://example.org/x",
    });
    expect(next.id).not.toBe(failed.id);
    expect(api.workflow.statuses.get(next.id)).toBe("running");
    expect(await api.listed()).toEqual([next]);
  });

  test("refuses a narration that did not fail", async () => {
    const api = apiSetup();
    const ready = await api.seed({ durationSeconds: 1, state: "ready" });
    const making = await api.seed(
      { stage: "reading", state: "making" },
      { running: true }
    );
    for (const id of [ready.id, making.id]) {
      // eslint-disable-next-line no-await-in-loop -- One request at a time.
      const response = await api.call("POST", `/${id}/retry`);
      expect(response.status).toBe(409);
    }
  });

  test("answers 404 for a narration that does not exist", async () => {
    const api = apiSetup();
    expect(await api.status("POST", "/0000000000000-00000000/retry")).toBe(404);
  });
});

describe("removing", () => {
  test("deletes a ready narration and its audio", async () => {
    const api = apiSetup();
    const ready = await api.seed({ durationSeconds: 1, state: "ready" });
    const kept = await api.seed({ reason: "No.", state: "failed" });
    const response = await api.call("DELETE", `/${ready.id}`);
    expect(response.status).toBe(204);
    expect(api.keys()).toEqual([
      `narrations/${kept.id}/narration.json`,
      `narrations/${kept.id}/parts/0.mp3`,
    ]);
  });

  test("refuses a narration still being made", async () => {
    const api = apiSetup();
    const making = await api.seed(
      { stage: "recording", state: "making" },
      { running: true }
    );
    expect(await api.status("DELETE", `/${making.id}`)).toBe(409);
  });

  test("deletes a narration whose run stopped without cleaning up", async () => {
    const api = apiSetup();
    const stopped = await api.seed({
      createdAt: LONG_AGO,
      stage: "recording",
      state: "making",
    });
    expect(await api.status("DELETE", `/${stopped.id}`)).toBe(204);
    expect(api.keys()).toEqual([]);
  });

  test("answers 404 for a narration that does not exist", async () => {
    const api = apiSetup();
    expect(await api.status("DELETE", "/0000000000000-00000000")).toBe(404);
  });
});

describe("playing", () => {
  test("streams a ready narration, with seeking", async () => {
    const api = apiSetup();
    const ready = await api.seed({ durationSeconds: 1, state: "ready" });
    const whole = await api.call("GET", `/${ready.id}/audio`);
    expect(whole.status).toBe(200);
    expect(whole.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(new Uint8Array(await whole.arrayBuffer())).toEqual(speech(4));
    const part = await api.call("GET", `/${ready.id}/audio`, {
      headers: { Range: "bytes=2-5" },
    });
    expect(part.status).toBe(206);
    expect(part.headers.get("Content-Range")).toBe(
      `bytes 2-5/${speech(4).length}`
    );
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(
      speech(4).slice(2, 6)
    );
  });

  test("has nothing to play until the narration is ready", async () => {
    const api = apiSetup();
    const making = await api.seed(
      { stage: "recording", state: "making" },
      { running: true }
    );
    expect(await api.status("GET", `/${making.id}/audio`)).toBe(404);
    expect(await api.status("GET", "/0000000000000-00000000/audio")).toBe(404);
  });

  test("plays only for someone signed in", async () => {
    const api = apiSetup();
    const ready = await api.seed({ durationSeconds: 1, state: "ready" });
    api.access.signedIn = false;
    expect(await api.status("GET", `/${ready.id}/audio`)).toBe(401);
  });
});

test("answers 404 for an unknown address", async () => {
  const api = apiSetup();
  expect(await api.status("GET", "/a/b/c/d")).toBe(404);
});
