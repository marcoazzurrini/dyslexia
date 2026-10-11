import "./support/workers.ts";
import { describe, expect, test } from "bun:test";

import { Effect, Option } from "effect";

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
  keepPictures,
  publish,
  readArticle,
  recordPart,
  reportProgress,
  settle,
  stop,
  writeScript,
} from "../src/making.ts";
import type { Script as WrittenScript } from "../src/services/writer.ts";
import { secondsOf, speech, spoken } from "./support/audio.ts";
import { memoryBucket } from "./support/bucket.ts";
import {
  ARTICLE,
  fakeServices,
  PICTURE,
  runtimeWith,
  scriptOf,
} from "./support/fakes.ts";
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
  test("plans the parts to record and starts recording", async () => {
    const { id, runtime, stored } = await setup();
    const { parts } = await runtime.runPromise(writeScript(id, ARTICLE));
    expect(parts.map(({ text }) => text)).toEqual([ARTICLE.text]);
    expect(await stored()).toMatchObject({
      progress: { done: 0, total: parts.length },
      stage: "recording",
      state: "making",
      title: ARTICLE.title,
    });
  });

  test("saves the title the writer gave the article", async () => {
    const { id, runtime, stored } = await setup({
      write: () => Effect.succeed(scriptOf(["Reading."], "Reading is recent")),
    });
    await runtime.runPromise(writeScript(id, ARTICLE));
    expect(await stored()).toMatchObject({ title: "Reading is recent" });
  });

  test("trusts the writer: a script shorter than the article is used as written", async () => {
    const { calls, id, runtime } = await setup({
      write: () => Effect.succeed(scriptOf(["Reading is recent."])),
    });
    const { parts } = await runtime.runPromise(writeScript(id, ARTICLE));
    expect(parts.map(({ text }) => text)).toEqual(["Reading is recent."]);
    expect(calls.write).toBe(1);
  });

  test("writes again when the writer gives an incomplete answer", async () => {
    const { calls, id, runtime } = await setup({
      write: inTurn<WrittenScript, ScriptIncomplete>(
        Effect.fail(new ScriptIncomplete()),
        Effect.succeed(scriptOf(["Reading is recent."]))
      ),
    });
    await runtime.runPromise(writeScript(id, ARTICLE));
    expect(calls.write).toBe(2);
  });

  test("writes again when the script shows a visual the article does not have", async () => {
    const { calls, id, runtime } = await setup({
      write: inTurn<WrittenScript, ScriptIncomplete>(
        Effect.succeed({
          items: [{ kind: "visual", say: "", visual: 1 }],
          title: ARTICLE.title,
        }),
        Effect.succeed(scriptOf(["Reading is recent."]))
      ),
    });
    const { items } = await runtime.runPromise(writeScript(id, ARTICLE));
    expect(items).toEqual([{ kind: "paragraph", text: "Reading is recent." }]);
    expect(calls.write).toBe(2);
  });

  test("stops after four incomplete answers", async () => {
    const { calls, id, runtime } = await setup({
      write: () => Effect.fail(new ScriptIncomplete()),
    });
    const error = await runtime.runPromise(
      Effect.flip(writeScript(id, ARTICLE))
    );
    expect(error._tag).toBe("ScriptIncomplete");
    expect(calls.write).toBe(4);
  });

  test("refuses a script over its limit", async () => {
    const { id, runtime } = await setup({
      write: () =>
        Effect.succeed(scriptOf(["a".repeat(MAX_SCRIPT_CHARACTERS + 1)])),
    });
    expect(
      await runtime.runPromise(Effect.flip(writeScript(id, ARTICLE)))
    ).toMatchObject({ _tag: "ScriptIncomplete" });
  });
});

describe("recording", () => {
  test("records a part, and when each character of it is said", async () => {
    const { calls, id, keys, runtime } = await setup();
    expect(await runtime.runPromise(recordPart(id, 3, "Part four."))).toEqual({
      seconds: secondsOf(2),
      starts: spoken("Part four.").starts,
    });
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
  test("publishing joins the parts, saves the transcript, and marks the narration ready", async () => {
    const { id, json, keys, record, runtime, stored } = await setup({
      write: () => Effect.succeed(scriptOf(["One.", "Two."])),
    });
    const planned = await runtime.runPromise(writeScript(id, ARTICLE));
    const recorded = await runtime.runPromise(
      Effect.all(
        planned.parts.map(({ text }, index) => recordPart(id, index, text))
      )
    );
    expect(
      await runtime.runPromise(publish(id, planned, recorded))
    ).toBeCloseTo(secondsOf(2));
    expect(await stored()).toEqual({
      createdAt: record.createdAt,
      durationSeconds: secondsOf(2),
      id,
      state: "ready",
      title: ARTICLE.title,
      transcript: true,
      url: record.url,
    });
    expect(keys()).toEqual([
      `narrations/${id}/audio.mp3`,
      `narrations/${id}/narration.json`,
      `narrations/${id}/transcript.json`,
    ]);
    expect(json(`narrations/${id}/transcript.json`)).toMatchObject({
      items: [
        { kind: "paragraph", start: 0, text: "One." },
        { kind: "paragraph", text: "Two." },
      ],
      version: 1,
    });
  });

  test("keeps the pictures the script shows, and shows them from the app", async () => {
    const article = {
      text: "![A map](https://example.org/map.png)\n\n![A logo](/logo.png)\n\n![Gone](https://example.org/gone.png)\n\nThe end.",
      title: "Maps",
    };
    const { calls, files, id, json, runtime } = await setup({
      fetchPicture: (url) =>
        url.endsWith("gone.png") ? Option.none() : Option.some(PICTURE),
      write: () =>
        Effect.succeed({
          items: [
            { kind: "visual", say: "A map of the town.", visual: 1 },
            { kind: "visual", say: "", visual: 3 },
            { kind: "paragraph", say: "The end.", visual: null },
          ],
          title: "Maps",
        }),
    });
    const planned = await runtime.runPromise(writeScript(id, article));
    const kept = await runtime.runPromise(keepPictures(id, planned));
    // The logo is not in the script, so it is never fetched.
    expect(calls.pictures).toEqual([
      "https://example.org/map.png",
      "https://example.org/gone.png",
    ]);
    expect(kept).toEqual({
      "https://example.org/map.png": `/api/narrations/${id}/pictures/0`,
    });
    expect(files.get(`narrations/${id}/pictures/0`)?.httpMetadata).toEqual({
      contentType: "image/png",
    });
    const recorded = await runtime.runPromise(
      Effect.all(
        planned.parts.map(({ text }, index) => recordPart(id, index, text))
      )
    );
    await runtime.runPromise(publish(id, planned, recorded, kept));
    expect(json(`narrations/${id}/transcript.json`)).toMatchObject({
      items: [
        { visual: { src: `/api/narrations/${id}/pictures/0` } },
        { visual: { src: "https://example.org/gone.png" } },
        { text: "The end." },
      ],
    });
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
