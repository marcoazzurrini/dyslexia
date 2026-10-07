import "./support/workers.ts";
import { describe, expect, mock, test } from "bun:test";

import type { ExecutionContext } from "@cloudflare/workers-types";

import type { NarrationsEnv } from "../src/config.ts";
import { KEYS, ORIGIN } from "./support/api.ts";
import { secondsOf, speech } from "./support/audio.ts";
import { memoryBucket } from "./support/bucket.ts";
import { fakeSteps, fakeWorkflow } from "./support/fakes.ts";
import { routeFetch } from "./support/network.ts";

// The Workers runtime module, as far as a Workflow class needs it.
await mock.module("cloudflare:workers", () => ({
  WorkflowEntrypoint: class {
    readonly env: NarrationsEnv;

    constructor(_context: ExecutionContext, env: NarrationsEnv) {
      this.env = env;
    }
  },
}));

const { API_PATH, handleNarrations, isConfigured, NarrationWorkflow } =
  await import("../src/index.ts");

const ARTICLE =
  "Reading is a recent invention.\n\nIt recycles the visual system.";

/** The three outside services, answering as they would for one article. */
const services = (reader: () => Response) => {
  const asked: string[] = [];
  routeFetch((request) => {
    const { host } = new URL(request.url);
    asked.push(host);
    if (host === "api.firecrawl.dev") {
      return Promise.resolve(reader());
    }
    if (host === "openrouter.ai") {
      return Promise.resolve(
        Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify({ text: ARTICLE }) },
            },
          ],
        })
      );
    }
    if (host === "api.elevenlabs.io") {
      return Promise.resolve(new Response(speech(3)));
    }
    return Promise.reject(new Error(`Unexpected request to ${host}`));
  });
  return asked;
};

const readable = () =>
  Response.json({
    data: {
      markdown: ARTICLE,
      metadata: { statusCode: 200, title: "Reading" },
    },
    success: true,
  });

const setup = () => {
  const memory = memoryBucket();
  const workflow = fakeWorkflow();
  const env = { AUDIO: memory.bucket, NARRATION: workflow.binding, ...KEYS };
  const access = { isSignedIn: () => Promise.resolve(true) };
  const request = (method: string, path = "", body?: { url: string }) =>
    handleNarrations(
      new Request(`${ORIGIN}${API_PATH}${path}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
        method,
      }),
      env,
      access
    );
  const make = async (id: string) => {
    // SAFETY: a Workflow reads nothing from its execution context.
    const instance = new NarrationWorkflow({} as ExecutionContext, env);
    await instance.run(
      {
        instanceId: id,
        payload: { id },
        timestamp: new Date(),
        workflowName: "dyslexia-narration",
      },
      fakeSteps().step
    );
  };
  return { ...memory, env, make, request };
};

describe("narrations, from link to recording", () => {
  test("is configured only with every key", () => {
    const { env } = setup();
    expect(isConfigured(env)).toBe(true);
    expect(isConfigured({ ...env, ELEVENLABS_API_KEY: undefined })).toBe(false);
  });

  test("makes a narration of an article and serves its recording", async () => {
    const asked = services(readable);
    const { keys, make, request } = setup();
    const started = await request("POST", "", {
      url: "https://example.org/reading",
    });
    const { id } = await started.json();
    await make(id);
    expect(asked).toEqual([
      "api.firecrawl.dev",
      "openrouter.ai",
      "api.elevenlabs.io",
    ]);

    const listing = await request("GET");
    expect(await listing.json()).toEqual([
      expect.objectContaining({
        audioUrl: `${API_PATH}/${id}/audio`,
        durationSeconds: secondsOf(3),
        id,
        state: "ready",
        title: "Reading",
        url: "https://example.org/reading",
      }),
    ]);
    const audio = await request("GET", `/${id}/audio`);
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(speech(3));
    expect(keys()).toEqual([
      `narrations/${id}/audio.mp3`,
      `narrations/${id}/narration.json`,
    ]);
  });

  test("explains a failure and keeps nothing it made", async () => {
    services(() => new Response("Blocked", { status: 403 }));
    const { keys, make, request } = setup();
    const started = await request("POST", "", {
      url: "https://example.org/paywalled",
    });
    const { id } = await started.json();
    await expect(make(id)).rejects.toThrow();
    const listing = await request("GET");
    expect(await listing.json()).toEqual([
      expect.objectContaining({
        id,
        reason: expect.stringContaining("could not be read"),
        state: "failed",
      }),
    ]);
    expect(keys()).toEqual([`narrations/${id}/narration.json`]);
  });
});
