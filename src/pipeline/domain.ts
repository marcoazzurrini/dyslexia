/* eslint-disable max-classes-per-file -- Keep the two tagged failures with their domain schemas. */
import { Data, Effect, Schema } from "effect";

export const MAX_SOURCE_CHARACTERS = 80_000;
export const MAX_DRAFT_CHARACTERS = 100_000;
export const MAX_CHUNK_CHARACTERS = 3000;
export const MAX_CHUNKS = 40;

const nonBlank = Schema.String.check(Schema.isPattern(/\S/u));

// Budgets count UTF-16 characters across all document strings, including metadata.
export const SourceDocumentSchema = Schema.Struct({
  markdown: nonBlank.check(Schema.isMaxLength(MAX_SOURCE_CHARACTERS)),
  sourceUrl: nonBlank,
  title: nonBlank,
}).check(
  Schema.makeFilter(
    (document) =>
      document.markdown.length +
        document.sourceUrl.length +
        document.title.length <=
      MAX_SOURCE_CHARACTERS
  )
);
export type SourceDocument = typeof SourceDocumentSchema.Type;

export const NarrationDraftSchema = Schema.Struct({
  sourceUrl: nonBlank,
  text: nonBlank.check(Schema.isMaxLength(MAX_DRAFT_CHARACTERS)),
  title: nonBlank,
}).check(
  Schema.makeFilter(
    (draft) =>
      draft.text.length + draft.sourceUrl.length + draft.title.length <=
      MAX_DRAFT_CHARACTERS
  )
);
export type NarrationDraft = typeof NarrationDraftSchema.Type;

export class InvalidInput extends Data.TaggedError("InvalidInput")<{
  readonly message: string;
}> {}

/** Safe diagnostics only. Never attach SDK errors, response bodies, or credentials. */
export class ProviderFailure extends Data.TaggedError("ProviderFailure")<{
  readonly provider: "firecrawl" | "openrouter" | "elevenlabs";
  readonly operation: "extract" | "adapt" | "generate";
  readonly message: string;
}> {}

const invalidUrl = () =>
  new InvalidInput({
    message: "Use a public HTTPS URL without credentials or a custom port.",
  });
const hostnameLabel = /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/u;
const privateSuffix =
  /(?:^|\.)(?:localhost|localdomain|local|internal|intranet|lan|home|corp|private|example|test|invalid|onion|arpa)$/u;

/**
 * Syntactic policy, not DNS verification. Firecrawl must enforce destination and
 * redirect restrictions; no source URL is fetched directly by this application.
 * Only the default HTTPS port is allowed. Fragments are not sent to extraction.
 */
export const validateSourceUrl = Effect.fn("pipeline.validateSourceUrl")(
  (value: string): Effect.Effect<string, InvalidInput> =>
    Effect.try({
      catch: invalidUrl,
      try: () => {
        if (!/^https:\/\//iu.test(value) || /[\s\\]/u.test(value)) {
          throw invalidUrl();
        }
        const authority = value.slice(8).split(/[/?#]/u)[0] ?? "";
        if (!authority || authority.includes("@") || authority.endsWith(":")) {
          throw invalidUrl();
        }
        const url = new URL(value);
        const hostname = url.hostname.replace(/\.$/u, "");
        const labels = hostname.split(".");
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.port ||
          hostname.length > 253 ||
          labels.length < 2 ||
          labels.some((label) => !hostnameLabel.test(label)) ||
          /^\d+$/u.test(labels.at(-1) ?? "") ||
          privateSuffix.test(hostname)
        ) {
          throw invalidUrl();
        }
        url.hostname = hostname;
        url.hash = "";
        return url.href;
      },
    })
);

const sentenceBoundary = /[.!?]["')\]]*\s+/gu;

const chunkEnd = (text: string, start: number): number => {
  let end = Math.min(start + MAX_CHUNK_CHARACTERS, text.length);
  if (end === text.length) {
    return end;
  }
  const window = text.slice(start, end);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph >= MAX_CHUNK_CHARACTERS / 2) {
    return start + paragraph + 2;
  }
  let sentenceEnd = 0;
  for (const match of window.matchAll(sentenceBoundary)) {
    sentenceEnd = match.index + match[0].length;
  }
  if (sentenceEnd >= MAX_CHUNK_CHARACTERS / 2) {
    return start + sentenceEnd;
  }
  // UTF-16 is the limit unit. Do not split a surrogate pair at a hard boundary.
  if ((text.codePointAt(end - 1) ?? 0) > 65_535) {
    end -= 1;
  }
  return end;
};

/**
 * Normalize CRLF/CR to LF and trim only outer whitespace. Concatenating chunk
 * text with no separator reproduces that normalized text exactly. Prefer late
 * paragraph/sentence boundaries; long sentences use the hard UTF-16 limit.
 * Throws InvalidInput for blank/oversized text or plans exceeding 40 chunks.
 */
export const chunkNarration = (
  text: string
): readonly { index: number; text: string }[] => {
  if (!Schema.is(nonBlank)(text) || text.length > MAX_DRAFT_CHARACTERS) {
    throw new InvalidInput({
      message: "Narration must contain 1 to 100000 characters.",
    });
  }
  const normalized = text.replaceAll(/\r\n?/gu, "\n").trim();
  const chunks: { index: number; text: string }[] = [];
  let start = 0;
  while (start < normalized.length) {
    if (chunks.length === MAX_CHUNKS) {
      throw new InvalidInput({
        message: "Narration exceeds the 40-chunk limit.",
      });
    }
    const end = chunkEnd(normalized, start);
    const chunk = normalized.slice(start, end);
    if (!chunk.trim()) {
      throw new InvalidInput({
        message: "Narration contains an excessively long blank section.",
      });
    }
    chunks.push({ index: chunks.length, text: chunk });
    start = end;
  }
  return chunks;
};
