import { MAX_PART_CHARACTERS } from "./limits.ts";

const sentenceEnd = /[.!?]["')\]]*\s+/gu;

// Prefer to end a part at a paragraph, then at a sentence, as long as the
// part stays at least half full. Otherwise cut at the limit.
const partEnd = (text: string, start: number) => {
  const end = Math.min(start + MAX_PART_CHARACTERS, text.length);
  if (end === text.length) {
    return end;
  }
  const window = text.slice(start, end);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph >= MAX_PART_CHARACTERS / 2) {
    return start + paragraph + 2;
  }
  let sentence = 0;
  for (const match of window.matchAll(sentenceEnd)) {
    sentence = match.index + match[0].length;
  }
  if (sentence >= MAX_PART_CHARACTERS / 2) {
    return start + sentence;
  }
  // Never split a character made of two UTF-16 code units.
  return (text.codePointAt(end - 1) ?? 0) > 0xff_ff ? end - 1 : end;
};

/**
 * Splits a script into parts the voice service accepts. Joined together, the
 * parts give back the script with its line endings normalized and its outer
 * whitespace trimmed.
 */
export const splitIntoParts = (script: string): string[] => {
  const text = script.replaceAll(/\r\n?/gu, "\n").trim();
  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = partEnd(text, start);
    parts.push(text.slice(start, end));
    start = end;
  }
  // A part of only whitespace has nothing to say.
  return parts.filter((part) => part.trim());
};
