const sentences = new Intl.Segmenter("en", { granularity: "sentence" });
const words = new Intl.Segmenter("en", { granularity: "word" });

/** The last boundary of `segmenter` within `window`, or 0. */
const lastBoundary = (segmenter: Intl.Segmenter, window: string) => {
  let boundary = 0;
  for (const { index } of segmenter.segment(window)) {
    boundary = index;
  }
  return boundary;
};

// Prefer to end a piece at a sentence, then at a word, as long as the piece
// stays at least half full. Otherwise cut at the limit.
const pieceEnd = (text: string, start: number, max: number) => {
  const end = start + max;
  if (end >= text.length) {
    return text.length;
  }
  // Include the next character, so a boundary right at the limit counts.
  const window = text.slice(start, end + 1);
  for (const segmenter of [sentences, words]) {
    const boundary = lastBoundary(segmenter, window);
    if (boundary >= max / 2 && boundary <= max) {
      return start + boundary;
    }
  }
  // Never split a character made of two UTF-16 code units.
  const split = (text.codePointAt(end - 1) ?? 0) > 0xff_ff;
  return split && end - 1 > start ? end - 1 : end;
};

// A cut inside a direction to the voice, such as [sighs], would have the
// voice say its words. Cut before it instead.
const beforeDirection = (text: string, start: number, end: number) => {
  const open = text.lastIndexOf("[", end - 1);
  return open > start && text.indexOf("]", open) >= end ? open : end;
};

/**
 * Splits text into pieces of at most `max` characters, which join back into
 * the text. A text that fits stays whole.
 */
export const splitText = (text: string, max: number): string[] => {
  const pieces: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = beforeDirection(text, start, pieceEnd(text, start, max));
    pieces.push(text.slice(start, end));
    start = end;
  }
  return pieces;
};
