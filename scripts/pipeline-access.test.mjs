import assert from "node:assert/strict";
import { test } from "node:test";

import { pipelineApi } from "../src/pipeline/api.ts";
import { signCapability } from "../src/pipeline/auth.ts";
import { chunkNarration } from "../src/pipeline/domain.ts";

const origin = "https://dyslexia.marcoazzurrini.com";
const environment = () => ({
  AUDIO: { list: () => Promise.resolve({ objects: [] }) },
  ELEVENLABS_API_KEY: "fake",
  FIRECRAWL_API_KEY: "fake",
  NARRATION: {},
  OPENROUTER_API_KEY: "fake",
  PIPELINE_ACCESS_TOKEN: "simple",
  PIPELINE_SIGNING_SECRET: "test-only-signing-key-longer-than-32-characters",
});
const login = (env) =>
  pipelineApi(
    new Request(`${origin}/api/pipeline/session`, {
      body: JSON.stringify({ token: "simple" }),
      headers: { "Content-Type": "application/json", Origin: origin },
      method: "POST",
    }),
    env
  );

test("human password is separate from session signing", async () => {
  const env = environment();
  const response = await login(env);
  assert.equal(response.status, 200);
  const [cookie] = response.headers.get("Set-Cookie").split(";");
  const jobs = await pipelineApi(
    new Request(`${origin}/api/pipeline/jobs`, {
      headers: { Cookie: cookie },
    }),
    env
  );
  assert.equal(jobs.status, 200);
});

test("a cookie signed with the human password is rejected", async () => {
  const env = environment();
  const forged = await signCapability(env.PIPELINE_ACCESS_TOKEN, {
    expires: Date.now() + 60_000,
    scope: "session",
  });
  const response = await pipelineApi(
    new Request(`${origin}/api/pipeline/jobs`, {
      headers: { Cookie: `narration_session=${forged}` },
    }),
    env
  );
  assert.equal(response.status, 401);
});

test("login enforces its rate limit", async () => {
  const env = environment();
  env.PIPELINE_LOGIN_LIMIT = {
    limit: () => Promise.resolve({ success: false }),
  };
  const response = await login(env);
  assert.equal(response.status, 429);
});

test("short passwords require an independent signing secret", async () => {
  const env = environment();
  delete env.PIPELINE_SIGNING_SECRET;
  const response = await login(env);
  assert.equal(response.status, 503);
});

test("blank speech chunks are rejected before generation", () => {
  assert.throws(
    () => chunkNarration(`Start.${" ".repeat(12_000)}End.`),
    /blank section/u
  );
});
