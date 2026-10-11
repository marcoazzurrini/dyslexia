/**
 * Transcript: a narration's text, timed against its recording, so a reader
 * can follow the voice word by word. It keeps the article's visuals, such as
 * pictures, code, and tables, where they stand, including those the voice
 * leaves out.
 *
 * This entry is safe for the browser. The server makes transcripts with
 * `@dyslexia/transcript/making`.
 */
export {
  TranscriptItemSchema,
  TranscriptSchema,
  VisualSchema,
} from "./format.ts";
export type { Transcript, TranscriptItem, Visual } from "./format.ts";
export { positionAt } from "./position.ts";
export type { Position } from "./position.ts";
