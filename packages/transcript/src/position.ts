import type { Transcript, TranscriptItem } from "./format.ts";

/** Where the voice is: an item of the transcript, and a word of its text. */
export interface Position {
  /** The item being said, or the one about to be. */
  readonly item: number;
  /** The word being said, for headings and paragraphs once it has started. */
  readonly word: number | undefined;
}

const isSpoken = (item: TranscriptItem | undefined) =>
  item !== undefined && item.end > item.start;

/** The last index whose start is at or before `seconds`, or -1. */
const lastStarted = <A>(
  values: readonly A[],
  startOf: (value: A) => number,
  seconds: number
) => {
  let low = 0;
  let high = values.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const value = values[middle];
    if (value !== undefined && startOf(value) <= seconds) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};

/**
 * Where the voice is at `seconds` into the recording. Visuals the voice
 * leaves out are never where it is. Before the first word, it is at the
 * first item it says. Undefined only when the voice says nothing.
 */
export const positionAt = (
  transcript: Transcript,
  seconds: number
): Position | undefined => {
  const { items } = transcript;
  let index = lastStarted(items, (item) => item.start, seconds);
  while (index >= 0 && !isSpoken(items[index])) {
    index -= 1;
  }
  const item = items[index];
  if (!item) {
    const first = items.findIndex(isSpoken);
    return first === -1 ? undefined : { item: first, word: undefined };
  }
  if (item.kind === "visual") {
    return { item: index, word: undefined };
  }
  const word = lastStarted(item.words, (entry) => entry[2], seconds);
  return { item: index, word: word === -1 ? undefined : word };
};
