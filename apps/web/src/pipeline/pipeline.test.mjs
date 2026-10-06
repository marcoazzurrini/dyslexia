import assert from "node:assert/strict";
import { test } from "node:test";

import { Effect, Layer } from "effect";

import { pipelineApi } from "./api.ts";
import {
  authenticated,
  matchesSecret,
  sameOrigin,
  sessionCookie,
  signCapability,
  verifyCapability,
} from "./auth.ts";
import { ProviderFailure } from "./domain.ts";
import { Extractor, NarrationAdapter, SpeechGenerator } from "./providers.ts";
import { paidArtifact, runPipeline } from "./run.ts";
import {
  artifactKey,
  estimateTts,
  getJob,
  initializeJob,
  putJson,
} from "./storage.ts";

const secret = "test-only-access-token-with-more-than-32-characters";
const origin = "https://dyslexia.marcoazzurrini.com";
const memoryBucket = () => {
  const values = new Map();
  return {
    get(key) {
      const value = values.get(key);
      return Promise.resolve(
        value ? { json: () => new Response(value).json() } : null
      );
    },
    head(key) {
      const value = values.get(key);
      return Promise.resolve(value ? { key, size: value.byteLength } : null);
    },
    list({ prefix, limit }) {
      return Promise.resolve({
        objects: [...values.keys()]
          .filter((key) => key.startsWith(prefix))
          .toSorted()
          .slice(0, limit)
          .map((key) => ({ key })),
      });
    },
    async put(key, value, options) {
      const bytes = new Uint8Array(await new Response(value).arrayBuffer());
      if (options?.onlyIf?.etagDoesNotMatch === "*" && values.has(key)) {
        return null;
      }
      values.set(key, bytes);
      return { key, size: bytes.byteLength };
    },
    values,
  };
};

const makeEnv = (bucket = memoryBucket()) => ({
  AUDIO: bucket,
  ELEVENLABS_API_KEY: "test",
  FIRECRAWL_API_KEY: "test",
  NARRATION: {
    create: () => Promise.resolve({}),
    get: () => Promise.resolve({ sendEvent: () => Promise.resolve() }),
  },
  OPENROUTER_API_KEY: "test",
  PIPELINE_ACCESS_TOKEN: secret,
});

const fakeWorkflowStep = (id, gates = {}, payloads = {}) => ({
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- WorkflowStep.do requires both platform callback overloads.
  async do(_name, options, callback) {
    return await (callback ?? options)();
  },
  waitForEvent(_name, { type }) {
    const gate = gates[type];
    if (gate) {
      gate.waiting.resolve();
      return gate.approval.promise;
    }
    return Promise.resolve({
      payload: payloads[type] ?? {
        key: artifactKey(
          id,
          type === "source-approved" ? "source.json" : "draft.json"
        ),
        maxCostUsd: 10,
      },
    });
  },
});

const fakeAssembler = (env, jobId) => ({
  get: () => ({
    fetch: async (_url, request) => {
      const input = JSON.parse(request.body);
      assert.equal(input.chunkCount, 1);
      assert.equal(
        await verifyCapability(
          input.token,
          env.PIPELINE_SIGNING_SECRET ?? secret,
          "assembly",
          jobId
        ),
        true
      );
      await env.AUDIO.put(
        artifactKey(jobId, "recording.mp3"),
        new Uint8Array([73, 68, 51, 0])
      );
      return Response.json({ bytes: 4, durationSeconds: 1 });
    },
  }),
  idFromName: (name) => name,
});

const providerLayer = (counts, shouldFail = false) =>
  Layer.mergeAll(
    Layer.succeed(Extractor, {
      extract: (url) =>
        Effect.sync(() => {
          counts.extract += 1;
          return {
            markdown: "An entire short article for a test.",
            sourceUrl: url,
            title: "Example",
          };
        }),
    }),
    Layer.succeed(NarrationAdapter, {
      adapt: (source) =>
        Effect.sync(() => {
          counts.adapt += 1;
          return {
            sourceUrl: source.sourceUrl,
            text: source.markdown,
            title: source.title,
          };
        }),
    }),
    Layer.succeed(SpeechGenerator, {
      generate: () =>
        Effect.suspend(() => {
          counts.speech += 1;
          return shouldFail
            ? Effect.fail(
                new ProviderFailure({
                  message: "Test provider unavailable",
                  operation: "generate",
                  provider: "elevenlabs",
                })
              )
            : Effect.succeed({
                audio: new Uint8Array([73, 68, 51, 0]),
                requestId: "test-request",
              });
        }),
    })
  );

test("capabilities bind purpose, job and expiration and reject tampering", async () => {
  const token = await signCapability(secret, {
    expires: Date.now() + 60_000,
    jobId: "one",
    scope: "assembly",
  });
  assert.equal(await verifyCapability(token, secret, "assembly", "one"), true);
  assert.equal(await verifyCapability(token, secret, "assembly", "two"), false);
  assert.equal(await verifyCapability(token, secret, "session"), false);
  assert.equal(
    await verifyCapability(`${token}x`, secret, "assembly", "one"),
    false
  );
  const expired = await signCapability(secret, {
    expires: Date.now() - 1,
    scope: "session",
  });
  assert.equal(await verifyCapability(expired, secret, "session"), false);
});

test("personal login checks the secret and issues a scoped HttpOnly cookie", async () => {
  assert.equal(await matchesSecret(secret, secret), true);
  assert.equal(await matchesSecret("wrong", secret), false);
  const request = new Request(`${origin}/api/pipeline/session`, {
    body: JSON.stringify({ token: secret }),
    headers: { "Content-Type": "application/json", Origin: origin },
    method: "POST",
  });
  const response = await pipelineApi(request, makeEnv());
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/u);
  assert.match(cookie, /SameSite=Strict/u);
  assert.match(cookie, /Secure/u);
  assert.equal(cookie.includes(secret), false);
  assert.equal(
    await authenticated(
      new Request(origin, { headers: { Cookie: cookie.split(";")[0] } }),
      secret
    ),
    true
  );
  assert.match(sessionCookie(request, "", 0), /Max-Age=0/u);
});

test("unauthenticated and cross-origin requests cannot start paid jobs", async () => {
  const env = makeEnv();
  let started = 0;
  env.NARRATION.create = () => {
    started += 1;
    return Promise.resolve({});
  };
  const response = await pipelineApi(
    new Request(`${origin}/api/pipeline/jobs`, {
      body: JSON.stringify({ url: "https://example.com/article" }),
      method: "POST",
    }),
    env
  );
  assert.equal(response.status, 401);
  assert.equal(started, 0);
  assert.equal(
    sameOrigin(
      new Request(origin, { headers: { Origin: "https://evil.example" } })
    ),
    false
  );
  const crossOriginResponse = await pipelineApi(
    new Request(`${origin}/api/pipeline/session`, {
      body: JSON.stringify({ token: secret }),
      headers: { Origin: "https://evil.example" },
      method: "POST",
    }),
    env
  );
  assert.equal(crossOriginResponse.status, 403);
});

test("a persisted paid artifact is reused, and incomplete intent blocks retry", async () => {
  const bucket = memoryBucket();
  const job = await initializeJob(bucket, "https://example.com/article");
  let calls = 0;
  const produce = async () => {
    calls += 1;
    await putJson(bucket, artifactKey(job.id, "source.json"), { saved: true });
  };
  await paidArtifact(bucket, job.id, "source.json", produce);
  await paidArtifact(bucket, job.id, "source.json", produce);
  assert.equal(calls, 1);
  await assert.rejects(
    paidArtifact(bucket, job.id, "draft.json", () => {
      calls += 1;
      return Promise.reject(new Error("network"));
    })
  );
  await assert.rejects(
    paidArtifact(bucket, job.id, "draft.json", () => {
      calls += 1;
      return Promise.resolve();
    })
  );
  assert.equal(calls, 2);
  const uncertain = await getJob(bucket, job.id);
  assert.equal(uncertain.status, "uncertain");
});

test("workflow completes with fake providers and private assembly, without network", async () => {
  const env = makeEnv();
  const job = await initializeJob(env.AUDIO, "https://example.com/article");
  const counts = { adapt: 0, extract: 0, speech: 0 };
  env.ASSEMBLER = fakeAssembler(env, job.id);
  await runPipeline(
    env,
    { jobId: job.id, origin },
    fakeWorkflowStep(job.id),
    providerLayer(counts)
  );
  assert.deepEqual(counts, { adapt: 1, extract: 1, speech: 1 });
  const completed = await getJob(env.AUDIO, job.id);
  assert.equal(completed.status, "ready");
  assert.equal(completed.completedChunks, 1);
  assert.equal(completed.durationSeconds, 1);
  assert.equal(completed.audioKey, artifactKey(job.id, "recording.mp3"));
});

test("workflow waits for source approval before adaptation and draft approval before speech", async (t) => {
  const network = t.mock.method(globalThis, "fetch", () =>
    Promise.reject(new Error("Unexpected network request"))
  );
  const env = makeEnv();
  const job = await initializeJob(env.AUDIO, "https://example.com/article");
  const counts = { adapt: 0, extract: 0, speech: 0 };
  const sourceGate = {
    approval: Promise.withResolvers(),
    waiting: Promise.withResolvers(),
  };
  const draftGate = {
    approval: Promise.withResolvers(),
    waiting: Promise.withResolvers(),
  };
  const sourceEvent = {
    payload: { key: artifactKey(job.id, "source.json") },
  };
  const draftEvent = {
    payload: { key: artifactKey(job.id, "draft.json"), maxCostUsd: 10 },
  };
  env.ASSEMBLER = fakeAssembler(env, job.id);
  const running = runPipeline(
    env,
    { jobId: job.id, origin },
    fakeWorkflowStep(job.id, {
      "draft-approved": draftGate,
      "source-approved": sourceGate,
    }),
    providerLayer(counts)
  );
  t.after(async () => {
    // Release both gates even when an assertion fails, then drain the workflow.
    sourceGate.approval.resolve(sourceEvent);
    draftGate.approval.resolve(draftEvent);
    await running;
  });

  // Racing completion also fails promptly if a regression skips either gate.
  await Promise.race([sourceGate.waiting.promise, running]);
  const sourceReady = await getJob(env.AUDIO, job.id);
  assert.equal(sourceReady.status, "source_ready");
  assert.equal(await env.AUDIO.head(artifactKey(job.id, "draft.json")), null);
  assert.equal(await env.AUDIO.head(artifactKey(job.id, "chunks/0.mp3")), null);
  assert.deepEqual(counts, { adapt: 0, extract: 1, speech: 0 });

  sourceGate.approval.resolve(sourceEvent);
  await Promise.race([draftGate.waiting.promise, running]);
  const draftReady = await getJob(env.AUDIO, job.id);
  assert.equal(draftReady.status, "draft_ready");
  assert.equal(await env.AUDIO.head(artifactKey(job.id, "plan.json")), null);
  assert.equal(await env.AUDIO.head(artifactKey(job.id, "chunks/0.mp3")), null);
  assert.deepEqual(counts, { adapt: 1, extract: 1, speech: 0 });

  draftGate.approval.resolve(draftEvent);
  await running;
  assert.deepEqual(counts, { adapt: 1, extract: 1, speech: 1 });
  const completed = await getJob(env.AUDIO, job.id);
  assert.equal(completed.status, "ready");
  assert.equal(network.mock.callCount(), 0);
});

test("workflow replay does not repeat an ambiguous paid speech call", async () => {
  const env = makeEnv();
  const job = await initializeJob(env.AUDIO, "https://example.com/article");
  const counts = { adapt: 0, extract: 0, speech: 0 };
  const run = () =>
    runPipeline(
      env,
      { jobId: job.id, origin },
      fakeWorkflowStep(job.id),
      providerLayer(counts, true)
    );
  await assert.rejects(run());
  await assert.rejects(run());
  assert.deepEqual(counts, { adapt: 1, extract: 1, speech: 1 });
  const uncertain = await getJob(env.AUDIO, job.id);
  assert.equal(uncertain.status, "uncertain");
});

const completedWorkflow = async () => {
  const env = makeEnv();
  const job = await initializeJob(env.AUDIO, "https://example.com/article");
  const counts = { adapt: 0, extract: 0, speech: 0 };
  env.ASSEMBLER = fakeAssembler(env, job.id);
  const run = (payloads = {}) =>
    runPipeline(
      env,
      { jobId: job.id, origin },
      fakeWorkflowStep(job.id, {}, payloads),
      providerLayer(counts)
    );
  await run();
  return { counts, env, job, run };
};

for (const changedKey of [true, false]) {
  test(`restart rejects changed source ${changedKey ? "selection" : "contents"} before draft reuse`, async () => {
    const { counts, env, job, run } = await completedWorkflow();
    const saved = new Map(env.AUDIO.values);
    const key = artifactKey(
      job.id,
      changedKey ? "edited-source.json" : "source.json"
    );
    await putJson(env.AUDIO, key, {
      markdown: "A different article must not use the saved draft.",
      sourceUrl: job.url,
      title: "Edited",
    });
    await assert.rejects(run({ "source-approved": { key } }));
    assert.deepEqual(counts, { adapt: 1, extract: 1, speech: 1 });
    for (const name of [
      "draft.json",
      "plan.json",
      "chunks/0.mp3",
      "recording.mp3",
      "source-selection.json",
    ]) {
      const outputKey = artifactKey(job.id, name);
      assert.deepEqual(env.AUDIO.values.get(outputKey), saved.get(outputKey));
    }
    const failed = await getJob(env.AUDIO, job.id);
    assert.equal(failed.status, "failed");
  });
}

for (const change of ["selection", "contents", "budget"]) {
  test(`restart rejects changed speech ${change} without replacing plan or reusing audio`, async () => {
    const { counts, env, job, run } = await completedWorkflow();
    const saved = new Map(env.AUDIO.values);
    const key = artifactKey(
      job.id,
      change === "selection" ? "edited-draft.json" : "draft.json"
    );
    if (change !== "budget") {
      await putJson(env.AUDIO, key, {
        sourceUrl: job.url,
        text: "Different approved speech must not reuse the old audio.",
        title: "Edited",
      });
    }
    await assert.rejects(
      run({
        "draft-approved": { key, maxCostUsd: change === "budget" ? 9 : 10 },
      })
    );
    assert.deepEqual(counts, { adapt: 1, extract: 1, speech: 1 });
    for (const name of [
      "plan.json",
      "chunks/0.mp3",
      "recording.mp3",
      "speech-approval.json",
    ]) {
      const outputKey = artifactKey(job.id, name);
      assert.deepEqual(env.AUDIO.values.get(outputKey), saved.get(outputKey));
    }
    const failed = await getJob(env.AUDIO, job.id);
    assert.equal(failed.status, "failed");
  });
}

test("identical source and speech approval safely recover saved outputs", async () => {
  const { counts, env, job, run } = await completedWorkflow();
  const saved = new Map(env.AUDIO.values);
  // Simulate losing the assembly manifest after chunks and recording were saved.
  env.AUDIO.values.delete(artifactKey(job.id, "assembly.json"));
  env.PIPELINE_SIGNING_SECRET =
    "separate-test-signing-secret-not-the-human-access-token";
  await run();
  await run();
  assert.deepEqual(counts, { adapt: 1, extract: 1, speech: 1 });
  for (const [key, bytes] of saved) {
    if (key.startsWith(artifactKey(job.id, ""))) {
      assert.deepEqual(env.AUDIO.values.get(key), bytes);
    }
  }
  const recovered = await getJob(env.AUDIO, job.id);
  assert.equal(recovered.status, "ready");
});

test("an existing speech plan cannot be overwritten even before any chunk is saved", async () => {
  const env = makeEnv();
  const job = await initializeJob(env.AUDIO, "https://example.com/article");
  const counts = { adapt: 0, extract: 0, speech: 0 };
  const key = artifactKey(job.id, "plan.json");
  await putJson(env.AUDIO, key, [
    { index: 0, text: "An older approved plan." },
  ]);
  const saved = env.AUDIO.values.get(key);
  await assert.rejects(
    runPipeline(
      env,
      { jobId: job.id, origin },
      fakeWorkflowStep(job.id),
      providerLayer(counts)
    )
  );
  assert.deepEqual(env.AUDIO.values.get(key), saved);
  assert.equal(counts.speech, 0);
});

test("speech estimate uses the reviewed character count", () => {
  assert.equal(estimateTts("a".repeat(1000)), 0.08);
  assert.equal(estimateTts("a".repeat(100_000)), 8);
});
