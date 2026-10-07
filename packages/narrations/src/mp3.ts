/* eslint-disable no-bitwise -- MP3 frame headers are bit fields. */

/** What `joinMp3` wrote. */
export interface Mp3Summary {
  /** Total number of bytes passed to `write`. */
  readonly bytes: number;
  /** Playback length of the joined audio. */
  readonly durationSeconds: number;
}

/** A file is not usable MP3 audio, or its encoding differs from earlier files. */
export class Mp3Error extends Error {
  override name = "Mp3Error";
}

interface Frame {
  /** Header bits that must match across frames: version, layer, bitrate, rate. */
  readonly encoding: number;
  readonly length: number;
  readonly mono: boolean;
  readonly mpeg1: boolean;
  readonly sampleRate: number;
  readonly samples: number;
}

const SYNC = 0xff_e0_00_00;
const ENCODING_BITS = 0x00_1e_fc_00;
const ID3V1_LENGTH = 128;
const MPEG1_KBPS = [
  32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const MPEG2_KBPS = [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const MPEG1_RATES = [44_100, 48_000, 32_000];
// Indexed by the header's version bits: MPEG 2.5, reserved, MPEG 2, MPEG 1.
const RATE_DIVISORS = [4, 0, 2, 1];
// Bytes of side information after the header, which Xing and Info tags follow.
const SIDE_INFO = {
  mpeg1: { mono: 17, stereo: 32 },
  mpeg2: { mono: 9, stereo: 17 },
};

const text = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCodePoint(...bytes.subarray(offset, offset + length));

const readFrame = (view: DataView, offset: number): Frame | undefined => {
  if (offset + 4 > view.byteLength) {
    return undefined;
  }
  const header = view.getUint32(offset);
  const version = (header >>> 19) & 3;
  const layer = (header >>> 17) & 3;
  const bitrateIndex = (header >>> 12) & 15;
  const rateIndex = (header >>> 10) & 3;
  // Layer III only; reject reserved values and free-format bitrates.
  if (
    (header & SYNC) >>> 0 !== SYNC ||
    version === 1 ||
    layer !== 1 ||
    bitrateIndex === 0 ||
    bitrateIndex === 15 ||
    rateIndex === 3
  ) {
    return undefined;
  }
  const mpeg1 = version === 3;
  const kbps = (mpeg1 ? MPEG1_KBPS : MPEG2_KBPS)[bitrateIndex - 1] ?? 0;
  const sampleRate =
    (MPEG1_RATES[rateIndex] ?? 0) / (RATE_DIVISORS[version] ?? 1);
  const samples = mpeg1 ? 1152 : 576;
  const mono = ((header >>> 6) & 3) === 3;
  return {
    encoding: (header & ENCODING_BITS) | (mono ? 1 : 0),
    length:
      Math.floor(((samples / 8) * kbps * 1000) / sampleRate) +
      ((header >>> 9) & 1),
    mono,
    mpeg1,
    sampleRate,
    samples,
  };
};

// Xing and Info headers follow the side information; VBRI has a fixed offset.
const isEncoderHeader = (bytes: Uint8Array, offset: number, frame: Frame) => {
  const sideInfo =
    SIDE_INFO[frame.mpeg1 ? "mpeg1" : "mpeg2"][frame.mono ? "mono" : "stereo"];
  const tag = text(bytes, offset + 4 + sideInfo, 4);
  return (
    tag === "Xing" || tag === "Info" || text(bytes, offset + 36, 4) === "VBRI"
  );
};

const skipId3v2 = (bytes: Uint8Array, fail: (reason: string) => never) => {
  let offset = 0;
  while (text(bytes, offset, 3) === "ID3") {
    const size = bytes.subarray(offset + 6, offset + 10);
    if (size.length < 4 || size.some((byte) => byte > 0x7f)) {
      fail("its ID3 tag is damaged");
    }
    const [a = 0, b = 0, c = 0, d = 0] = size;
    const footer = ((bytes[offset + 5] ?? 0) & 0x10) === 0 ? 0 : 10;
    offset += 10 + footer + ((a << 21) | (b << 14) | (c << 7) | d);
  }
  return offset;
};

// Finds the audio frames of one file and checks them against `expected`.
const scan = (
  bytes: Uint8Array,
  index: number,
  expected: Frame | undefined
) => {
  const fail = (reason: string): never => {
    throw new Mp3Error(`File ${index + 1} cannot be joined: ${reason}`);
  };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = skipId3v2(bytes, fail);
  let start = offset;
  let first = expected;
  let frames = 0;
  for (
    let frame = readFrame(view, offset);
    frame;
    frame = readFrame(view, offset)
  ) {
    if (offset + frame.length > bytes.length) {
      fail("its last frame is cut short");
    }
    if (
      frames === 0 &&
      offset === start &&
      isEncoderHeader(bytes, offset, frame)
    ) {
      start = offset + frame.length;
    } else {
      first ??= frame;
      if (frame.encoding !== first.encoding) {
        fail(
          expected
            ? "its encoding differs from the earlier files"
            : "its bitrate or format changes partway through"
        );
      }
      frames += 1;
    }
    offset += frame.length;
  }
  const trailing = bytes.length - offset;
  const id3v1 = trailing === ID3V1_LENGTH && text(bytes, offset, 3) === "TAG";
  if (trailing !== 0 && !id3v1) {
    fail(`it has unrecognized data at byte ${offset}`);
  }
  if (!first || frames === 0) {
    return fail("it contains no audio");
  }
  return { end: offset, frame: first, frames, start };
};

/**
 * Joins complete MP3 files into one continuous MP3 stream.
 *
 * Each item of `files` must be a whole MP3 file. Metadata tags and encoder
 * header frames are dropped, so players measure the joined stream from its
 * audio instead of trusting the first file's header. Audio is passed to
 * `write` in order; return a promise from `write` to apply backpressure.
 *
 * Every file must be MPEG Layer III audio with the same version, sample rate,
 * channel count, and constant bitrate, so that the output stays seekable
 * without a header. Nothing from an invalid file is written.
 *
 * @throws {Mp3Error} If a file is invalid, mismatched, or there is no audio.
 */
export const joinMp3 = async (
  files: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  write: (audio: Uint8Array) => void | Promise<void>
): Promise<Mp3Summary> => {
  let expected: Frame | undefined;
  let bytes = 0;
  let samples = 0;
  let index = 0;
  for await (const file of files) {
    const audio = scan(file, index, expected);
    expected = audio.frame;
    await write(file.subarray(audio.start, audio.end));
    bytes += audio.end - audio.start;
    samples += audio.frames * audio.frame.samples;
    index += 1;
  }
  if (!expected) {
    throw new Mp3Error("There are no files to join");
  }
  return { bytes, durationSeconds: samples / expected.sampleRate };
};
