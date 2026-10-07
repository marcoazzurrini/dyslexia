/* eslint-disable no-bitwise -- Tests build MP3 frame headers, which are bit fields. */
import { describe, expect, test } from "bun:test";

import { joinMp3, Mp3Error } from "../src/mp3.ts";

interface Options {
  frames?: number;
  kbps?: number;
  layer?: 2 | 3;
  mono?: boolean;
  version?: 1 | 2;
  sampleRate?: number;
  id3?: boolean;
  info?: boolean;
  id3v1?: boolean;
  fill?: number;
}

const MPEG1_KBPS = [
  32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const MPEG2_KBPS = [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SIDE_INFO = { 1: { mono: 17, stereo: 32 }, 2: { mono: 9, stereo: 17 } };

// Builds a structurally valid MP3 file. Payload bytes are not decodable audio,
// which is fine because joining never decodes.
const mp3 = ({
  frames = 3,
  kbps = 128,
  layer = 3,
  mono = true,
  version = 1,
  sampleRate = version === 1 ? 44_100 : 22_050,
  id3 = true,
  info = true,
  id3v1 = false,
  fill = 0xaa,
}: Options = {}) => {
  const rates =
    version === 1 ? [44_100, 48_000, 32_000] : [22_050, 24_000, 16_000];
  const samples = version === 1 ? 1152 : 576;
  const frame = (payload: number, tag?: string) => {
    const length = Math.floor(((samples / 8) * kbps * 1000) / sampleRate);
    const bytes = new Uint8Array(length).fill(payload);
    const header =
      (0xff_e0_00_00 |
        ((version === 1 ? 3 : 2) << 19) |
        ((layer === 3 ? 1 : 2) << 17) |
        (1 << 16) |
        (((version === 1 ? MPEG1_KBPS : MPEG2_KBPS).indexOf(kbps) + 1) << 12) |
        (rates.indexOf(sampleRate) << 10) |
        ((mono ? 3 : 0) << 6)) >>>
      0;
    new DataView(bytes.buffer).setUint32(0, header);
    if (tag) {
      const sideInfo = SIDE_INFO[version][mono ? "mono" : "stereo"];
      bytes.set(new TextEncoder().encode(tag), 4 + sideInfo);
    }
    return bytes;
  };
  const parts: Uint8Array[] = [];
  if (id3) {
    parts.push(
      new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 5, 1, 2, 3, 4, 5])
    );
  }
  if (info) {
    parts.push(frame(0, "Info"));
  }
  for (let index = 0; index < frames; index += 1) {
    parts.push(frame(fill));
  }
  if (id3v1) {
    const tag = new Uint8Array(128);
    tag.set(new TextEncoder().encode("TAG"));
    parts.push(tag);
  }
  return Uint8Array.from(parts.flatMap((part) => [...part]));
};

const join = async (
  files: Iterable<Uint8Array> | AsyncIterable<Uint8Array>
) => {
  const written: Uint8Array[] = [];
  const summary = await joinMp3(files, (audio) => {
    written.push(audio);
  });
  const output = Uint8Array.from(written.flatMap((part) => [...part]));
  return { output, summary, written };
};

const contains = (bytes: Uint8Array, value: string) =>
  Buffer.from(bytes).includes(Buffer.from(value));

const fixture = async (name: string) =>
  new Uint8Array(
    await Bun.file(new URL(`fixtures/${name}`, import.meta.url)).arrayBuffer()
  );

describe("joinMp3", () => {
  test("keeps only audio frames, in order, and measures their duration", async () => {
    const first = mp3({ fill: 1, frames: 2 });
    const second = mp3({ fill: 2, frames: 3, id3v1: true });
    const { output, summary } = await join([first, second]);

    expect(output.length).toBe(5 * 417);
    expect(summary).toEqual({
      bytes: 5 * 417,
      durationSeconds: (5 * 1152) / 44_100,
    });
    expect(contains(output, "ID3")).toBe(false);
    expect(contains(output, "Info")).toBe(false);
    expect(contains(output, "TAG")).toBe(false);
    expect(output[4]).toBe(1);
    expect(output[2 * 417 + 4]).toBe(2);
  });

  test("joins real encoder output into a stream with no per-file headers", async () => {
    const files = [await fixture("a.mp3"), await fixture("b.mp3")];
    const { output, summary } = await join(files);

    expect(summary.bytes).toBe(output.length);
    expect(output[0]).toBe(0xff);
    expect(contains(output, "ID3")).toBe(false);
    expect(contains(output, "Info")).toBe(false);
    // Encoders pad each file by up to about two frames beyond the requested length.
    expect(summary.durationSeconds).toBeGreaterThanOrEqual(0.8);
    expect(summary.durationSeconds).toBeLessThan(0.8 + 4 * (1152 / 44_100));
  });

  test("accepts files without tags or encoder headers", async () => {
    const { summary } = await join([mp3({ id3: false, info: false })]);
    expect(summary.bytes).toBe(3 * 417);
  });

  test("reads files lazily and waits for each write", async () => {
    const events: string[] = [];
    const files = async function* files() {
      events.push("read 1");
      yield mp3();
      events.push("read 2");
      yield mp3();
    };
    await joinMp3(files(), async () => {
      events.push("write start");
      await Bun.sleep(1);
      events.push("write end");
    });
    expect(events).toEqual([
      "read 1",
      "write start",
      "write end",
      "read 2",
      "write start",
      "write end",
    ]);
  });

  test("measures MPEG-2 frames, which hold half as many samples", async () => {
    const { summary } = await join([mp3({ kbps: 64, version: 2 })]);
    expect(summary.durationSeconds).toBe((3 * 576) / 22_050);
  });

  test("joins stereo files", async () => {
    const { summary } = await join([
      mp3({ mono: false }),
      mp3({ mono: false }),
    ]);
    expect(summary.bytes).toBe(6 * 417);
  });
});

const rejects = async (files: Uint8Array[], message: string) => {
  const written: Uint8Array[] = [];
  const joining = joinMp3(files, (audio) => {
    written.push(audio);
  });
  await expect(joining).rejects.toBeInstanceOf(Mp3Error);
  await expect(joining).rejects.toThrow(message);
  return written;
};

describe("joinMp3 rejects", () => {
  test("an empty list", async () => {
    await rejects([], "There are no files to join");
  });

  test("a file with no audio frames", async () => {
    await rejects(
      [mp3({ frames: 0 })],
      "File 1 cannot be joined: it contains no audio"
    );
  });

  test("data that is not MP3", async () => {
    await rejects(
      [new TextEncoder().encode("not audio")],
      "unrecognized data at byte 0"
    );
  });

  test("a truncated last frame", async () => {
    const file = mp3();
    await rejects([file.subarray(0, -10)], "its last frame is cut short");
  });

  test("unexpected data after the audio", async () => {
    const file = Uint8Array.from([...mp3(), 1, 2, 3]);
    await rejects([file], "unrecognized data at byte");
  });

  test("a damaged ID3 tag", async () => {
    const file = mp3();
    file[6] = 0xff;
    await rejects([file], "its ID3 tag is damaged");
  });

  test("Layer II audio", async () => {
    await rejects(
      [mp3({ id3: false, info: false, layer: 2 })],
      "unrecognized data at byte 0"
    );
  });

  test("a bitrate that changes within a file", async () => {
    const file = Uint8Array.from([
      ...mp3(),
      ...mp3({ id3: false, info: false, kbps: 160 }),
    ]);
    await rejects([file], "its bitrate or format changes partway through");
  });

  test("files with different encodings, without writing the mismatched file", async () => {
    const written = await rejects(
      [mp3(), mp3({ sampleRate: 48_000 })],
      "File 2 cannot be joined: its encoding differs from the earlier files"
    );
    expect(written).toHaveLength(1);
  });

  test("mono and stereo files together", async () => {
    await rejects([mp3(), mp3({ mono: false })], "its encoding differs");
  });
});
