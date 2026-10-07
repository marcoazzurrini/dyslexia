import type {
  FixedLengthStream as FixedLengthStreamType,
  R2Bucket,
} from "@cloudflare/workers-types";
import { Array as Arr, Clock, Context, Effect, Layer, Schema } from "effect";

import { serveAudioObject } from "../audio.ts";
import { NarrationNotFound } from "../errors.ts";
import { MAX_LISTED } from "../limits.ts";
import { joinMp3 } from "../mp3.ts";
import { NarrationRecordSchema } from "../narration.ts";
import type { NarrationRecord } from "../narration.ts";

// A Workers runtime global: R2 stores a streamed upload only when its length
// is declared up front.
declare const FixedLengthStream: typeof FixedLengthStreamType;

// Each narration keeps its files in one folder:
//   narrations/<id>/narration.json   what the app shows
//   narrations/<id>/parts/<n>.mp3    recorded parts, until they are joined
//   narrations/<id>/audio.mp3        the finished recording
// Ids start with the time counted down, so the newest lists first.
const ROOT = "narrations/";
const ID = /^\d{13}-[\da-f]{8}$/u;
const folder = (id: string) => `${ROOT}${id}/`;
const recordKey = (id: string) => `${folder(id)}narration.json`;
const partKey = (id: string, index: number) =>
  `${folder(id)}parts/${index}.mp3`;
const audioKey = (id: string) => `${folder(id)}audio.mp3`;

const newId = (now: number) =>
  `${String(9_999_999_999_999 - now).padStart(13, "0")}-${crypto
    .randomUUID()
    .slice(0, 8)}`;

const siteOf = (url: string) => new URL(url).hostname.replace(/^www\./u, "");

const r2 = <A>(operation: () => Promise<A>) => Effect.promise(operation);

const decodeRecord = Schema.decodeUnknownEffect(
  Schema.fromJsonString(NarrationRecordSchema)
);

// eslint-disable-next-line no-use-before-define -- The type of the service the class below names.
const makeStore = (bucket: R2Bucket): Store["Service"] => {
  const get = Effect.fn("Store.get")(function* storeGet(id: string) {
    const object = ID.test(id)
      ? yield* r2(() => bucket.get(recordKey(id)))
      : null;
    if (!object) {
      return yield* new NarrationNotFound();
    }
    return yield* decodeRecord(yield* r2(() => object.text())).pipe(
      Effect.orDie
    );
  });

  const save = (record: NarrationRecord) =>
    r2(() =>
      bucket.put(recordKey(record.id), JSON.stringify(record), {
        httpMetadata: { contentType: "application/json" },
      })
    ).pipe(Effect.asVoid);

  const keysIn = Effect.fn("Store.keysIn")(function* storeKeysIn(
    prefix: string
  ) {
    const keys: string[] = [];
    let next: string | undefined;
    do {
      const cursor = next;
      const page = yield* r2(() => bucket.list({ cursor, prefix }));
      keys.push(...page.objects.map((object) => object.key));
      next = page.truncated ? page.cursor : undefined;
    } while (next);
    return keys;
  });

  const deleteKeys = (keys: readonly string[]) =>
    Effect.forEach(
      Arr.chunksOf(keys, 1000),
      (batch) => r2(() => bucket.delete([...batch])),
      { discard: true }
    );

  const parts = (id: string, count: number) =>
    async function* read() {
      for (let index = 0; index < count; index += 1) {
        // eslint-disable-next-line no-await-in-loop -- Hold one part at a time: a whole recording can exceed Worker memory.
        const object = await bucket.get(partKey(id, index));
        if (!object) {
          throw new Error(`Part ${index} of ${id} is missing`);
        }
        // eslint-disable-next-line no-await-in-loop -- See above.
        yield new Uint8Array(await object.arrayBuffer());
      }
    };

  const joinInto = async (id: string, count: number) => {
    // R2 stores a stream only when its length is known, so measure first.
    const { bytes } = await joinMp3(parts(id, count)(), () =>
      Promise.resolve()
    );
    const { readable, writable } = new FixedLengthStream(bytes);
    const writer = writable.getWriter();
    const joining = (async () => {
      try {
        const summary = await joinMp3(parts(id, count)(), (audio) =>
          writer.write(audio)
        );
        await writer.close();
        return summary;
      } catch (error) {
        await writer.abort(error);
        throw error;
      }
    })();
    const [summary] = await Promise.all([
      joining,
      bucket.put(audioKey(id), readable, {
        httpMetadata: { contentType: "audio/mpeg" },
      }),
    ]);
    return summary.durationSeconds;
  };

  return {
    audio: (id, request) =>
      r2(() => serveAudioObject(request, audioKey(id), bucket)),
    clear: Effect.fn("Store.clear")(function* storeClear(id: string) {
      const keys = yield* keysIn(folder(id));
      yield* deleteKeys(keys.filter((key) => key !== recordKey(id)));
    }),
    create: Effect.fn("Store.create")(function* storeCreate(url: string) {
      const now = yield* Clock.currentTimeMillis;
      const record: NarrationRecord = {
        createdAt: new Date(now).toISOString(),
        id: newId(now),
        stage: "reading",
        state: "making",
        title: siteOf(url),
        url,
      };
      yield* save(record);
      return record;
    }),
    get,
    joinParts: Effect.fn("Store.joinParts")(function* storeJoinParts(
      id: string,
      count: number
    ) {
      const seconds = yield* Effect.promise(() => joinInto(id, count));
      yield* deleteKeys(
        Array.from({ length: count }, (_, index) => partKey(id, index))
      );
      return seconds;
    }),
    list: Effect.gen(function* listRecords() {
      const listing = yield* r2(() =>
        bucket.list({ delimiter: "/", limit: MAX_LISTED, prefix: ROOT })
      );
      const ids = listing.delimitedPrefixes
        .map((prefix) => prefix.slice(ROOT.length, -1))
        .filter((id) => ID.test(id));
      const records = yield* Effect.forEach(
        ids,
        (id) => Effect.option(get(id)),
        { concurrency: 8 }
      );
      return Arr.getSomes(records);
    }).pipe(Effect.withSpan("Store.list")),
    remove: Effect.fn("Store.remove")(function* storeRemove(id: string) {
      yield* deleteKeys(yield* keysIn(folder(id)));
    }),
    save,
    savePart: (id, index, audio) =>
      r2(() =>
        bucket.put(partKey(id, index), audio, {
          httpMetadata: { contentType: "audio/mpeg" },
        })
      ).pipe(Effect.asVoid),
  };
};

/**
 * Where narrations and their audio are kept. Storage failures are defects:
 * nothing can be done about them but to try the whole operation again.
 */
export class Store extends Context.Service<
  Store,
  {
    /** Saves a new narration, about to be made. */
    readonly create: (url: string) => Effect.Effect<NarrationRecord>;
    readonly get: (
      id: string
    ) => Effect.Effect<NarrationRecord, NarrationNotFound>;
    /** The newest narrations first. */
    readonly list: Effect.Effect<readonly NarrationRecord[]>;
    readonly save: (record: NarrationRecord) => Effect.Effect<void>;
    readonly savePart: (
      id: string,
      index: number,
      audio: Uint8Array
    ) => Effect.Effect<void>;
    /**
     * Joins the recorded parts into the finished recording, deletes them, and
     * returns its length in seconds.
     */
    readonly joinParts: (id: string, count: number) => Effect.Effect<number>;
    /** Deletes every file a narration made, but keeps the narration. */
    readonly clear: (id: string) => Effect.Effect<void>;
    /** Deletes a narration and all its files. */
    readonly remove: (id: string) => Effect.Effect<void>;
    /** Serves the finished recording, with byte ranges for seeking. */
    readonly audio: (id: string, request: Request) => Effect.Effect<Response>;
  }
>()("narrations/Store") {
  /** Keeps everything in an R2 bucket. */
  static readonly layer = (bucket: R2Bucket) =>
    Layer.succeed(Store, makeStore(bucket));
}

/** Whether a value could be a narration id. */
export const isNarrationId = (value: string) => ID.test(value);
