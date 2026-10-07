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

const words = (text: string) =>
  text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * Whether a script reads out the whole article rather than a summary. A
 * heuristic: the script must be at least 80% as long as the article and use
 * 85% of its words, 70% of every 120-word stretch, and 90% of its last 20
 * words.
 */
export const coversArticle = (article: string, script: string) => {
  if (script.trim().length < article.trim().length * 0.8) {
    return false;
  }
  const articleWords = words(article);
  const counts = new Map<string, number>();
  for (const word of words(script)) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const vocabulary = new Set(counts.keys());
  let matched = 0;
  for (const word of articleWords) {
    const count = counts.get(word) ?? 0;
    if (count > 0) {
      matched += 1;
      counts.set(word, count - 1);
    }
  }
  if (matched < articleWords.length * 0.85) {
    return false;
  }
  const share = (stretch: string[]) =>
    stretch.filter((word) => vocabulary.has(word)).length / stretch.length;
  for (let index = 0; index < articleWords.length; index += 120) {
    if (share(articleWords.slice(index, index + 120)) < 0.7) {
      return false;
    }
  }
  const ending = articleWords.slice(-20);
  return ending.length === 0 || share(ending) >= 0.9;
};
