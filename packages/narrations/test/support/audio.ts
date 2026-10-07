/** One MPEG-1 Layer III frame: 128 kbps, 44.1 kHz, mono, silent payload. */
const frame = () => {
  const bytes = new Uint8Array(417);
  new DataView(bytes.buffer).setUint32(0, 0xff_fb_90_c0);
  return bytes;
};

/** Valid MP3 audio of the given number of frames. */
export const speech = (frames = 2) => {
  const audio = new Uint8Array(417 * frames);
  for (let index = 0; index < frames; index += 1) {
    audio.set(frame(), index * 417);
  }
  return audio;
};

/** How long `speech(frames)` plays. */
export const secondsOf = (frames: number) => (frames * 1152) / 44_100;
