import "./support/workers.ts";
import { describe, expect, test } from "bun:test";

import { Effect, Option } from "effect";

import {
  ArticleUnreadable,
  INTERRUPTED,
  ServiceRejected,
} from "../src/errors.ts";
import { makeNarration } from "../src/workflow.ts";
import { secondsOf, speech } from "./support/audio.ts";
import { memoryBucket } from "./support/bucket.ts";
import {
  fakeServices,
  fakeSteps,
  recordingTracer,
  runtimeWith,
} from "./support/fakes.ts";
import type { Script } from "./support/fakes.ts";
import { withStore } from "./support/services.ts";

// Long enough for three parts.
const paragraph = (index: number) =>
  `Paragraph ${index} explains one more idea about reading. `.repeat(25);
const LONG_ARTICLE = {
  text: [1, 2, 3, 4, 5, 6].map(paragraph).join("\n\n"),
  title: "A long article",
};

const setup = async (script: Script = {}) => {
  const memory = memoryBucket();
  const services = fakeServices({
    read: () => Effect.succeed(LONG_ARTICLE),
    ...script,
  });
  const traces = recordingTracer();
  const runtime = runtimeWith(services, memory.bucket, traces.tracer);
  const { id } = await runtime.runPromise(
    withStore((store) => store.create("https://example.org/article"))
  );
  const stored = () => runtime.runPromise(withStore((store) => store.get(id)));
  return { ...memory, calls: services.calls, id, runtime, stored, traces };
};

describe("making a narration", () => {
  test("reads, writes, records each part, and publishes one recording", async () => {
    const { calls, id, keys, runtime, stored } = await setup();
    const steps = fakeSteps();
    await makeNarration(id, steps.step, runtime);
    expect(steps.names()).toEqual([
      "read the article",
      "write the script",
      "record part 1",
      "record part 2",
      "save progress 2",
      "record part 3",
      "save progress 3",
      "publish the recording",
    ]);
    expect(calls.speak.join("")).toBe(LONG_ARTICLE.text.trim());
    expect(await stored()).toMatchObject({
      durationSeconds: secondsOf(6),
      state: "ready",
      title: LONG_ARTICLE.title,
    });
    expect(keys()).toEqual([
      `narrations/${id}/audio.mp3`,
      `narrations/${id}/narration.json`,
    ]);
  });

  test("saves every step's result as plain JSON text", async () => {
    const { id, runtime } = await setup();
    const steps = fakeSteps();
    await makeNarration(id, steps.step, runtime);
    for (const result of steps.saved.values()) {
      expect(result).toEqual({ json: expect.any(String) });
    }
  });

  test("resumes after the Worker restarts, without paying twice", async () => {
    const { calls, id, runtime, stored } = await setup();
    const first = fakeSteps({ evictAt: "record part 3" });
    void makeNarration(id, first.step, runtime);
    await Bun.sleep(20);
    expect(calls.speak).toHaveLength(2);

    const second = fakeSteps({ saved: first.saved });
    await makeNarration(id, second.step, runtime);
    expect(second.names()).toEqual([
      "record part 3",
      "save progress 3",
      "publish the recording",
    ]);
    expect(calls.read).toHaveLength(1);
    expect(calls.write).toBe(1);
    expect(calls.speak).toHaveLength(3);
    expect(await stored()).toMatchObject({ state: "ready" });
  });
});

describe("when making a narration fails", () => {
  test("an unreadable page stops it and leaves only the reason", async () => {
    const { calls, id, keys, runtime, stored } = await setup({
      read: () => Effect.fail(new ArticleUnreadable()),
    });
    const steps = fakeSteps();
    await expect(makeNarration(id, steps.step, runtime)).rejects.toThrow(
      "could not be read"
    );
    expect(steps.names()).toEqual(["read the article", "clean up"]);
    expect(calls.write).toBe(0);
    expect(await stored()).toMatchObject({
      reason: expect.stringContaining("could not be read"),
      state: "failed",
    });
    expect(keys()).toEqual([`narrations/${id}/narration.json`]);
  });

  test("a refused part deletes every recorded part, after its batch finishes", async () => {
    const { calls, id, keys, runtime, stored } = await setup({
      speak: (text) =>
        text.startsWith("Paragraph 3")
          ? Effect.fail(new ServiceRejected({ service: "voice", status: 402 }))
          : Effect.succeed(speech()),
    });
    const steps = fakeSteps();
    await expect(makeNarration(id, steps.step, runtime)).rejects.toThrow(
      "refused"
    );
    // Both parts of the batch finish before the cleanup; no later part starts.
    expect(steps.names().toSorted()).toEqual([
      "clean up",
      "read the article",
      "record part 1",
      "record part 2",
      "write the script",
    ]);
    expect(steps.names().at(-1)).toBe("clean up");
    expect(calls.speak).toHaveLength(2);
    expect(await stored()).toMatchObject({
      reason:
        "The voice service refused the request (status 402). Check its API key and credit.",
      state: "failed",
    });
    expect(keys()).toEqual([`narrations/${id}/narration.json`]);
  });

  test("a crash is retried by Cloudflare, then reported as an interruption", async () => {
    const { calls, id, keys, runtime, stored } = await setup({
      speak: () => Effect.die(new Error("Worker crashed")),
    });
    const steps = fakeSteps();
    await expect(makeNarration(id, steps.step, runtime)).rejects.toThrow();
    expect(
      steps.calls.find((call) => call.name === "record part 1")?.attempts
    ).toBe(3);
    expect(calls.speak.length).toBeGreaterThanOrEqual(3);
    expect(await stored()).toMatchObject({
      reason: INTERRUPTED,
      state: "failed",
    });
    expect(keys()).toEqual([`narrations/${id}/narration.json`]);
  });

  test("a crash that passes on Cloudflare's retry does not stop the narration", async () => {
    let crashes = 1;
    const { id, runtime, stored } = await setup({
      speak: () => {
        if (crashes > 0) {
          crashes -= 1;
          return Effect.die(new Error("Worker crashed"));
        }
        return Effect.succeed(speech());
      },
    });
    await makeNarration(id, fakeSteps().step, runtime);
    expect(await stored()).toMatchObject({ state: "ready" });
  });
});

describe("tracing a narration", () => {
  test("puts a run's steps in one trace, under a span named for the narration", async () => {
    const { id, runtime, traces } = await setup();
    const before = traces.spans.length;
    await makeNarration(id, fakeSteps().step, runtime);
    const [root] = traces.named("make narration");
    expect(root?.attributes.get("narration.id")).toBe(id);
    const steps = traces.spans.filter(
      (span) => Option.getOrUndefined(span.parent)?.spanId === root?.spanId
    );
    // The same kind of step keeps one name, so runs can be compared.
    expect(steps.map((span) => span.name)).toEqual([
      "read the article",
      "write the script",
      "record part",
      "record part",
      "save progress",
      "record part",
      "save progress",
      "publish the recording",
    ]);
    expect(
      traces
        .named("record part")
        .map((span) => span.attributes.get("narration.part"))
    ).toEqual([1, 2, 3]);
    for (const span of traces.spans.slice(before)) {
      expect(span.traceId).toBe(root?.traceId ?? "");
    }
    // Langfuse filters on the narration in every step, not only the root.
    for (const span of [root, ...steps]) {
      expect(span?.attributes.get("langfuse.trace.metadata.narration_id")).toBe(
        id
      );
    }
  });

  test("shows the article link going in and the recording coming out", async () => {
    const { id, runtime, traces } = await setup();
    await makeNarration(id, fakeSteps().step, runtime);
    const [root] = traces.named("make narration");
    expect(
      JSON.parse(String(root?.attributes.get("langfuse.observation.input")))
    ).toEqual({ link: "https://example.org/article" });
    expect(
      JSON.parse(String(root?.attributes.get("langfuse.observation.output")))
    ).toEqual({
      durationSeconds: expect.any(Number),
      parts: 3,
      state: "ready",
    });
    expect(root?.attributes.has("langfuse.observation.level")).toBe(false);
  });

  test("records why a step stopped the narration", async () => {
    const { id, runtime, traces } = await setup({
      read: () => Effect.fail(new ArticleUnreadable()),
    });
    await makeNarration(id, fakeSteps().step, runtime).catch(() => {
      // The failure is checked in the trace.
    });
    const [read] = traces.named("read the article");
    expect(read?.attributes.get("narration.reason")).toEqual(
      expect.stringContaining("could not be read")
    );
    expect(read?.attributes.get("langfuse.observation.level")).toBe("ERROR");
    const [root] = traces.named("make narration");
    expect(root?.status).toMatchObject({
      _tag: "Ended",
      exit: { _tag: "Failure" },
    });
    expect(root?.attributes.get("langfuse.observation.level")).toBe("ERROR");
    expect(
      JSON.parse(String(root?.attributes.get("langfuse.observation.output")))
    ).toEqual({
      reason: expect.stringContaining("could not be read"),
      state: "failed",
    });
  });
});
