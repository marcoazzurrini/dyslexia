import "./support/workers.ts";
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import {
  ArticleUnreadable,
  ScriptIncomplete,
  ServiceRejected,
  ServiceUnavailable,
} from "../src/errors.ts";
import {
  MAX_ARTICLE_CHARACTERS,
  MAX_SCRIPT_CHARACTERS,
} from "../src/limits.ts";
import {
  publish,
  readArticle,
  recordPart,
  reportProgress,
  settle,
  stop,
  writeScript,
} from "../src/making.ts";
import { secondsOf, speech } from "./support/audio.ts";
import { memoryBucket } from "./support/bucket.ts";
import { ARTICLE, fakeServices, runtimeWith } from "./support/fakes.ts";
import type { Script } from "./support/fakes.ts";
import { withStore } from "./support/services.ts";

/** Answers each call with the next effect, then repeats the last. */
const inTurn = <A, E>(...answers: Effect.Effect<A, E>[]) => {
  let call = 0;
  return () => {
    const answer = answers[Math.min(call, answers.length - 1)];
    call += 1;
    return answer ?? Effect.die(new Error("No answer"));
  };
};

const setup = async (script: Script = {}) => {
  const memory = memoryBucket();
  const services = fakeServices(script);
  const runtime = runtimeWith(services, memory.bucket);
  const record = await runtime.runPromise(
    withStore((store) => store.create("https://example.org/article"))
  );
  const stored = () =>
    runtime.runPromise(withStore((store) => store.get(record.id)));
  return {
    ...memory,
    calls: services.calls,
    id: record.id,
    record,
    runtime,
    stored,
  };
};

const unavailable = (service: "reader" | "writer" | "voice") =>
  Effect.fail(new ServiceUnavailable({ service }));

describe("reading the article", () => {
  test("reads the narration's link and saves the article's title", async () => {
    const { calls, id, runtime, stored } = await setup();
    expect(await runtime.runPromise(readArticle(id))).toEqual(ARTICLE);
    expect(calls.read).toEqual(["https://example.org/article"]);
    expect(await stored()).toMatchObject({
      stage: "writing",
      state: "making",
      title: ARTICLE.title,
    });
  });

  test("accepts an article right at the limit", async () => {
    const text = "a".repeat(MAX_ARTICLE_CHARACTERS);
    const { id, runtime } = await setup({
      read: () => Effect.succeed({ text, title: "Long" }),
    });
    expect(await runtime.runPromise(readArticle(id))).toEqual({
      text,
      title: "Long",
    });
  });

  test("refuses an article over the limit, counting the extracted text", async () => {
    const { id, runtime, stored } = await setup({
      read: () =>
        Effect.succeed({
          text: "a".repeat(MAX_ARTICLE_CHARACTERS + 1),
          title: "Long",
        }),
    });
    const error = await runtime.runPromise(Effect.flip(readArticle(id)));
    expect(error).toMatchObject({
      _tag: "ArticleTooLong",
      characters: MAX_ARTICLE_CHARACTERS + 1,
    });
    expect(await stored()).toMatchObject({ state: "making" });
  });

  test("tries again when the reader is unavailable", async () => {
    const { calls, id, runtime } = await setup({
      read: inTurn(
        unavailable("reader"),
        unavailable("reader"),
        Effect.succeed(ARTICLE)
      ),
    });
    expect(await runtime.runPromise(readArticle(id))).toEqual(ARTICLE);
    expect(calls.read).toHaveLength(3);
  });

  test("gives up after three more tries", async () => {
    const { calls, id, runtime } = await setup({
      read: () => unavailable("reader"),
    });
    const error = await runtime.runPromise(Effect.flip(readArticle(id)));
    expect(error._tag).toBe("ServiceUnavailable");
    expect(calls.read).toHaveLength(4);
  });

  test("does not try again when the page cannot be read", async () => {
    const { calls, id, runtime } = await setup({
      read: () => Effect.fail(new ArticleUnreadable()),
    });
    expect(
      await runtime.runPromise(Effect.flip(readArticle(id)))
    ).toMatchObject({ _tag: "ArticleUnreadable" });
    expect(calls.read).toHaveLength(1);
  });

  test("does not try again when the reader refuses", async () => {
    const { calls, id, runtime } = await setup({
      read: () =>
        Effect.fail(new ServiceRejected({ service: "reader", status: 402 })),
    });
    expect(
      await runtime.runPromise(Effect.flip(readArticle(id)))
    ).toMatchObject({ _tag: "ServiceRejected" });
    expect(calls.read).toHaveLength(1);
  });
});

describe("writing the script", () => {
  test("splits the script into parts and starts recording", async () => {
    const { id, runtime, stored } = await setup();
    const parts = await runtime.runPromise(writeScript(id, ARTICLE));
    expect(parts.join("")).toBe(ARTICLE.text);
    expect(await stored()).toMatchObject({
      progress: { done: 0, total: parts.length },
      stage: "recording",
      state: "making",
    });
  });

  test("writes again when the script leaves part of the article out", async () => {
    const { calls, id, runtime } = await setup({
      write: inTurn(
        Effect.succeed("Reading is recent."),
        Effect.succeed(ARTICLE.text)
      ),
    });
    const parts = await runtime.runPromise(writeScript(id, ARTICLE));
    expect(parts.join("")).toBe(ARTICLE.text);
    expect(calls.write).toBe(2);
  });

  test("writes again when the writer gives an incomplete answer", async () => {
    const { calls, id, runtime } = await setup({
      write: inTurn<string, ScriptIncomplete>(
        Effect.fail(new ScriptIncomplete()),
        Effect.succeed(ARTICLE.text)
      ),
    });
    await runtime.runPromise(writeScript(id, ARTICLE));
    expect(calls.write).toBe(2);
  });

  test("stops after four incomplete scripts", async () => {
    const { calls, id, runtime } = await setup({
      write: () => Effect.succeed("A summary."),
    });
    const error = await runtime.runPromise(
      Effect.flip(writeScript(id, ARTICLE))
    );
    expect(error._tag).toBe("ScriptIncomplete");
    expect(calls.write).toBe(4);
  });

  test("refuses a script over its limit", async () => {
    const { id, runtime } = await setup({
      write: (article) =>
        Effect.succeed(
          article.text.repeat(
            Math.ceil((MAX_SCRIPT_CHARACTERS + 1) / article.text.length)
          )
        ),
    });
    expect(
      await runtime.runPromise(Effect.flip(writeScript(id, ARTICLE)))
    ).toMatchObject({ _tag: "ScriptIncomplete" });
  });
});

describe("recording", () => {
  test("records a part", async () => {
    const { calls, id, keys, runtime } = await setup();
    expect(await runtime.runPromise(recordPart(id, 3, "Part four."))).toBe(3);
    expect(calls.speak).toEqual(["Part four."]);
    expect(keys()).toContain(`narrations/${id}/parts/3.mp3`);
  });

  test("tries again when the voice is unavailable, then gives up", async () => {
    const { calls, id, keys, runtime } = await setup({
      speak: () => unavailable("voice"),
    });
    expect(
      await runtime.runPromise(Effect.flip(recordPart(id, 0, "Hi.")))
    ).toMatchObject({ _tag: "ServiceUnavailable" });
    expect(calls.speak).toHaveLength(4);
    expect(keys()).not.toContain(`narrations/${id}/parts/0.mp3`);
  });

  test("saves progress", async () => {
    const { id, runtime, stored } = await setup();
    expect(await runtime.runPromise(reportProgress(id, 4, 9))).toBe(4);
    expect(await stored()).toMatchObject({
      progress: { done: 4, total: 9 },
      stage: "recording",
    });
  });
});

describe("finishing", () => {
  test("publishing joins the parts and marks the narration ready", async () => {
    const { id, keys, record, runtime, stored } = await setup();
    await runtime.runPromise(
      Effect.gen(function* body() {
        yield* recordPart(id, 0, "One.");
        yield* recordPart(id, 1, "Two.");
      })
    );
    expect(await runtime.runPromise(publish(id, 2))).toBeCloseTo(secondsOf(4));
    expect(await stored()).toEqual({
      createdAt: record.createdAt,
      durationSeconds: secondsOf(4),
      id,
      state: "ready",
      title: record.title,
      url: record.url,
    });
    expect(keys()).toEqual([
      `narrations/${id}/audio.mp3`,
      `narrations/${id}/narration.json`,
    ]);
  });

  test("stopping deletes what was made and saves the reason", async () => {
    const { id, keys, runtime, stored } = await setup();
    await runtime.runPromise(recordPart(id, 0, "One."));
    await runtime.runPromise(stop(id, "Something broke."));
    expect(await stored()).toMatchObject({
      reason: "Something broke.",
      state: "failed",
    });
    expect(keys()).toEqual([`narrations/${id}/narration.json`]);
  });

  test("a failed step becomes a reason for the listener", async () => {
    const outcome = await Effect.runPromise(
      settle(Effect.fail(new ServiceUnavailable({ service: "voice" })))
    );
    expect(outcome).toEqual({
      ok: false,
      reason: "The voice service did not respond, even after several tries.",
    });
    expect(
      await Effect.runPromise(settle(Effect.succeed(speech().length)))
    ).toEqual({
      ok: true,
      value: 834,
    });
  });
});
