import assert from "node:assert/strict";
import { test } from "node:test";

import { pipelineApi } from "./api.ts";
import { chunkNarration } from "./domain.ts";

const origin = "https://dyslexia.marcoazzurrini.com";
const environment = () => {
  const started = [];
  return {
    AUDIO: { list: () => Promise.resolve({ objects: [] }) },
    ELEVENLABS_API_KEY: "fake",
    FIRECRAWL_API_KEY: "fake",
    NARRATION: {
      create: (job) => {
        started.push(job);
        return Promise.resolve({});
      },
    },
    OPENROUTER_API_KEY: "fake",
    started,
  };
};
// Stand-ins for Google sign-in; @dyslexia/auth has its own tests.
const signedIn = {
  handle: () => Promise.resolve(null),
  user: () =>
    Promise.resolve({ email: "me@example.com", image: null, name: "Me" }),
};
const signedOut = { ...signedIn, user: () => Promise.resolve(null) };

const submit = (env, auth, from = origin) =>
  pipelineApi(
    new Request(`${origin}/api/pipeline/jobs`, {
      body: JSON.stringify({ url: "https://example.com/article" }),
      headers: { "Content-Type": "application/json", Origin: from },
      method: "POST",
    }),
    env,
    auth
  );
const listJobs = (env, auth) =>
  pipelineApi(new Request(`${origin}/api/pipeline/jobs`), env, auth);
const session = async (env, auth, method = "GET") => {
  const response = await pipelineApi(
    new Request(`${origin}/api/pipeline/session`, { method }),
    env,
    auth
  );
  const body = response.status === 200 ? await response.json() : null;
  return { body, status: response.status };
};

test("signed-out visitors cannot list or start jobs", async () => {
  const env = environment();
  const jobs = await listJobs(env, signedOut);
  const created = await submit(env, signedOut);
  assert.equal(jobs.status, 401);
  assert.equal(created.status, 401);
  assert.equal(env.started.length, 0);
});

test("a signed-in user can list jobs", async () => {
  const jobs = await listJobs(environment(), signedIn);
  assert.equal(jobs.status, 200);
});

test("cross-site requests cannot start paid jobs, even when signed in", async () => {
  const env = environment();
  const created = await submit(env, signedIn, "https://evil.example");
  assert.equal(created.status, 403);
  assert.equal(env.started.length, 0);
});

test("the session endpoint reports sign-in state and nothing else", async () => {
  const env = environment();
  assert.deepEqual(await session(env, signedIn), {
    body: { authenticated: true, configured: true },
    status: 200,
  });
  assert.deepEqual(await session(env, signedOut), {
    body: { authenticated: false, configured: true },
    status: 200,
  });
  const post = await session(env, signedIn, "POST");
  assert.equal(post.status, 405);
});

test("missing sign-in configuration is reported, not bypassed", async () => {
  // Without Google settings in the environment, the API has no sign-in.
  const env = environment();
  const state = await pipelineApi(
    new Request(`${origin}/api/pipeline/session`),
    env
  );
  const created = await pipelineApi(
    new Request(`${origin}/api/pipeline/jobs`, {
      body: JSON.stringify({ url: "https://example.com/article" }),
      headers: { "Content-Type": "application/json", Origin: origin },
      method: "POST",
    }),
    env
  );
  assert.deepEqual(await state.json(), {
    authenticated: false,
    configured: false,
  });
  assert.equal(created.status, 503);
});

test("blank speech chunks are rejected before generation", () => {
  assert.throws(
    () => chunkNarration(`Start.${" ".repeat(12_000)}End.`),
    /blank section/u
  );
});
