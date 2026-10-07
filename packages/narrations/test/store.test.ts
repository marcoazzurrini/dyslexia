import "./support/workers.ts";
import { describe, expect, test } from "bun:test";

import { Effect, Exit } from "effect";
import { TestClock } from "effect/testing";

import { Store } from "../src/services/store.ts";
import { secondsOf, speech } from "./support/audio.ts";
import { memoryBucket } from "./support/bucket.ts";
import { withStore } from "./support/services.ts";

const setup = () => {
  const memory = memoryBucket();
  const run = <A, E>(effect: Effect.Effect<A, E, Store>) =>
    Effect.runPromise(effect.pipe(Effect.provide(Store.layer(memory.bucket))));
  const exit = <A, E>(effect: Effect.Effect<A, E, Store>) =>
    Effect.runPromiseExit(
      effect.pipe(Effect.provide(Store.layer(memory.bucket)))
    );
  return { ...memory, exit, run };
};

const create = (url = "https://www.example.org/article") =>
  withStore((store) => store.create(url));

describe("storing narrations", () => {
  test("creates a narration being read, titled after its site", async () => {
    const { json, run } = setup();
    const record = await run(create());
    expect(record).toMatchObject({
      stage: "reading",
      state: "making",
      title: "example.org",
      url: "https://www.example.org/article",
    });
    expect(record.id).toMatch(/^\d{13}-[\da-f]{8}$/u);
    expect(json(`narrations/${record.id}/narration.json`)).toEqual(record);
    expect(await run(withStore((store) => store.get(record.id)))).toEqual(
      record
    );
  });

  test("lists the newest first", async () => {
    const { run } = setup();
    const ids = await run(
      Effect.gen(function* body() {
        const first = yield* create("https://example.org/1");
        yield* TestClock.adjust("1 second");
        const second = yield* create("https://example.org/2");
        yield* TestClock.adjust("1 second");
        const third = yield* create("https://example.org/3");
        return [third.id, second.id, first.id];
      }).pipe(Effect.provide(TestClock.layer()))
    );
    const listed = await run(withStore((store) => store.list));
    expect(listed.map((record) => record.id)).toEqual(ids);
  });

  test("lists at most 50", async () => {
    const { run } = setup();
    await run(Effect.forEach(Array.from({ length: 55 }), () => create()));
    expect(await run(withStore((store) => store.list))).toHaveLength(50);
  });

  test("ignores files that are not narrations", async () => {
    const { bucket, run } = setup();
    await bucket.put("narrations/not-an-id/narration.json", "{}");
    await bucket.put("pipeline/jobs/old.json", "{}");
    const record = await run(create());
    expect(await run(withStore((store) => store.list))).toEqual([record]);
  });

  test("does not find a narration that does not exist", async () => {
    const { run } = setup();
    const errors = await Promise.all(
      ["0000000000000-00000000", "../etc/passwd", ""].map((id) =>
        run(Effect.flip(withStore((store) => store.get(id))))
      )
    );
    for (const error of errors) {
      expect(error).toMatchObject({ _tag: "NarrationNotFound" });
    }
  });

  test("treats a damaged narration file as a defect", async () => {
    const { bucket, exit, run } = setup();
    const record = await run(create());
    await bucket.put(
      `narrations/${record.id}/narration.json`,
      '{"state":"nonsense"}'
    );
    const result = await exit(withStore((store) => store.get(record.id)));
    expect(Exit.hasDies(result)).toBe(true);
  });

  test("saves changes", async () => {
    const { run } = setup();
    const record = await run(create());
    const ready = {
      createdAt: record.createdAt,
      durationSeconds: 61,
      id: record.id,
      state: "ready" as const,
      title: "Title",
      url: record.url,
    };
    await run(withStore((store) => store.save(ready)));
    expect(await run(withStore((store) => store.get(record.id)))).toEqual(
      ready
    );
  });
});

describe("storing audio", () => {
  test("joins recorded parts into one recording and deletes the parts", async () => {
    const { keys, run } = setup();
    const { id } = await run(create());
    const seconds = await run(
      Effect.gen(function* body() {
        const store = yield* Store;
        yield* store.savePart(id, 0, speech(2));
        yield* store.savePart(id, 1, speech(3));
        yield* store.savePart(id, 2, speech(1));
        return yield* store.joinParts(id, 3);
      })
    );
    expect(seconds).toBeCloseTo(secondsOf(6));
    expect(keys()).toEqual([
      `narrations/${id}/audio.mp3`,
      `narrations/${id}/narration.json`,
    ]);
    const response = await run(
      withStore((store) => store.audio(id, new Request("https://app.test/a")))
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(speech(6));
  });

  test("seeks within the recording", async () => {
    const { run } = setup();
    const { id } = await run(create());
    await run(
      Effect.gen(function* body() {
        const store = yield* Store;
        yield* store.savePart(id, 0, speech(2));
        yield* store.joinParts(id, 1);
      })
    );
    const response = await run(
      withStore((store) =>
        store.audio(
          id,
          new Request("https://app.test/a", { headers: { Range: "bytes=0-3" } })
        )
      )
    );
    expect(response.status).toBe(206);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      speech(2).slice(0, 4)
    );
  });

  test("treats a missing part as a defect and saves no recording", async () => {
    const { exit, keys, run } = setup();
    const { id } = await run(create());
    await run(withStore((store) => store.savePart(id, 0, speech())));
    const result = await exit(withStore((store) => store.joinParts(id, 2)));
    expect(Exit.hasDies(result)).toBe(true);
    expect(keys()).not.toContain(`narrations/${id}/audio.mp3`);
  });

  test("treats audio that is not MP3 as a defect", async () => {
    const { exit, run } = setup();
    const { id } = await run(create());
    await run(
      withStore((store) => store.savePart(id, 0, new Uint8Array([1, 2, 3])))
    );
    expect(
      Exit.hasDies(await exit(withStore((store) => store.joinParts(id, 1))))
    ).toBe(true);
  });
});

/** Two narrations, one with two parts and one with one. */
const withFiles = async () => {
  const context = setup();
  const { id } = await context.run(create());
  const other = await context.run(create("https://example.org/other"));
  await context.run(
    Effect.gen(function* body() {
      const store = yield* Store;
      yield* store.savePart(id, 0, speech());
      yield* store.savePart(id, 1, speech());
      yield* store.savePart(other.id, 0, speech());
    })
  );
  return { ...context, id, other: other.id };
};

describe("deleting", () => {
  test("clearing keeps only the narration itself", async () => {
    const { id, keys, other, run } = await withFiles();
    await run(withStore((store) => store.clear(id)));
    expect(keys()).toEqual(
      [
        `narrations/${other}/narration.json`,
        `narrations/${other}/parts/0.mp3`,
        `narrations/${id}/narration.json`,
      ].toSorted()
    );
  });

  test("removing deletes the narration and its files, and nothing else", async () => {
    const { id, keys, other, run } = await withFiles();
    await run(withStore((store) => store.remove(id)));
    expect(keys()).toEqual([
      `narrations/${other}/narration.json`,
      `narrations/${other}/parts/0.mp3`,
    ]);
  });

  test("removing deletes files on every page of a long listing", async () => {
    const { keys, run } = setup();
    const { id } = await run(create());
    await run(
      Effect.forEach(
        Array.from({ length: 1205 }, (_, index) => index),
        (index) =>
          withStore((store) =>
            store.savePart(id, index, new Uint8Array([index % 256]))
          )
      )
    );
    await run(withStore((store) => store.remove(id)));
    expect(keys()).toEqual([]);
  });
});
