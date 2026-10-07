import type { R2Bucket } from "@cloudflare/workers-types";
import type { Schema } from "effect";

interface Stored {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly etag: string;
  readonly uploaded: Date;
}

/** What narrations store: JSON text, audio bytes, or a stream of audio. */
type Body = string | Uint8Array<ArrayBuffer> | ReadableStream<Uint8Array>;

const toBytes = async (value: Body) =>
  new Uint8Array(await new Response(value).arrayBuffer());

const objectOf = (key: string, stored: Stored) => ({
  etag: stored.etag,
  httpEtag: `"${stored.etag}"`,
  key,
  size: stored.bytes.byteLength,
  uploaded: stored.uploaded,
});

/**
 * An R2 bucket held in memory, with the operations narrations use. `files`
 * exposes what is stored, for assertions.
 */
export const memoryBucket = () => {
  const files = new Map<string, Stored>();
  let version = 0;
  const bucket = {
    delete: (keys: string | string[]) => {
      for (const key of [keys].flat()) {
        files.delete(key);
      }
      return Promise.resolve();
    },
    get: (
      key: string,
      options?: { range?: { offset: number; length: number } }
    ) => {
      const stored = files.get(key);
      if (!stored) {
        return Promise.resolve(null);
      }
      const range = options?.range;
      const bytes = range
        ? stored.bytes.slice(range.offset, range.offset + range.length)
        : stored.bytes;
      return Promise.resolve({
        ...objectOf(key, stored),
        arrayBuffer: () => Promise.resolve(new Uint8Array(bytes).buffer),
        body: new Response(bytes).body,
        text: () => Promise.resolve(new TextDecoder().decode(bytes)),
      });
    },
    head: (key: string) => {
      const stored = files.get(key);
      return Promise.resolve(stored ? objectOf(key, stored) : null);
    },
    list: ({
      cursor,
      delimiter,
      limit = 1000,
      prefix = "",
    }: {
      cursor?: string;
      delimiter?: string;
      limit?: number;
      prefix?: string;
    }) => {
      const keys = [...files.keys()]
        .filter((key) => key.startsWith(prefix))
        .toSorted();
      const prefixes = new Set<string>();
      const objects: string[] = [];
      for (const key of keys) {
        const rest = key.slice(prefix.length);
        const cut = delimiter ? rest.indexOf(delimiter) : -1;
        if (cut === -1) {
          objects.push(key);
        } else {
          prefixes.add(prefix + rest.slice(0, cut + 1));
        }
      }
      const entries = [
        ...objects.map((key) => ({ key, kind: "object" as const })),
        ...[...prefixes].map((key) => ({ key, kind: "prefix" as const })),
      ].toSorted((a, b) => a.key.localeCompare(b.key));
      const start = cursor ? Number(cursor) : 0;
      const page = entries.slice(start, start + limit);
      const truncated = start + limit < entries.length;
      return Promise.resolve({
        cursor: truncated ? String(start + limit) : undefined,
        delimitedPrefixes: page
          .filter((entry) => entry.kind === "prefix")
          .map((entry) => entry.key),
        objects: page
          .filter((entry) => entry.kind === "object")
          .map((entry) => {
            const stored = files.get(entry.key);
            if (!stored) {
              throw new Error(`Listed a missing key: ${entry.key}`);
            }
            return objectOf(entry.key, stored);
          }),
        truncated,
      });
    },
    put: async (key: string, value: Body) => {
      version += 1;
      const stored = {
        bytes: await toBytes(value),
        etag: `v${version}`,
        uploaded: new Date("2026-10-01T00:00:00Z"),
      };
      files.set(key, stored);
      return objectOf(key, stored);
    },
  };
  return {
    // SAFETY: implements every R2Bucket operation narrations call, with the
    // fields they read; tests would fail on any other use.
    // eslint-disable-next-line anti-slop/no-chained-type-assertions -- A partial stand-in for a platform binding.
    bucket: bucket as unknown as R2Bucket,
    files,
    /** A stored JSON file. */
    json: (key: string): typeof Schema.Json.Type => {
      const stored = files.get(key);
      return stored ? JSON.parse(new TextDecoder().decode(stored.bytes)) : null;
    },
    /** Every stored key, sorted. */
    keys: () => [...files.keys()].toSorted(),
  };
};

export type MemoryBucket = ReturnType<typeof memoryBucket>;
