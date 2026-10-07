// The Workers runtime provides FixedLengthStream, which fails when the bytes
// written differ from the declared length.
class FixedLengthStream extends TransformStream<Uint8Array, Uint8Array> {
  constructor(length: number) {
    let written = 0;
    super({
      flush() {
        if (written !== length) {
          throw new Error("Stream length differs from its declared length");
        }
      },
      transform(chunk, controller) {
        written += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
  }
}

Object.assign(globalThis, { FixedLengthStream });
