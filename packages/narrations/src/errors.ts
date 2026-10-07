/* eslint-disable max-classes-per-file, unicorn/throw-new-error -- Every failure a narration can meet, in one place. Schema.TaggedError<T>() builds a class; it does not throw. */
import { Match, Schema } from "effect";

import { MAX_ARTICLE_CHARACTERS } from "./limits.ts";

/** The outside services a narration depends on. */
export const ServiceSchema = Schema.Literals(["reader", "writer", "voice"]);
export type Service = typeof ServiceSchema.Type;

// Failures while making a narration.

/** The page could not be read as an article. */
export class ArticleUnreadable extends Schema.TaggedError<ArticleUnreadable>()(
  "ArticleUnreadable",
  {}
) {}

/** The article is longer than a narration may be. */
export class ArticleTooLong extends Schema.TaggedError<ArticleTooLong>()(
  "ArticleTooLong",
  { characters: Schema.Number }
) {}

/** The writer's answer was cut off, unreadable, or too long. */
export class ScriptIncomplete extends Schema.TaggedError<ScriptIncomplete>()(
  "ScriptIncomplete",
  {}
) {}

/** A service did not answer, timed out, or failed on its side. */
export class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()(
  "ServiceUnavailable",
  { service: ServiceSchema }
) {}

/** A service refused the request, as for a wrong key or no credit. */
export class ServiceRejected extends Schema.TaggedError<ServiceRejected>()(
  "ServiceRejected",
  { service: ServiceSchema, status: Schema.Number }
) {}

export type MakingError =
  | ArticleUnreadable
  | ArticleTooLong
  | ScriptIncomplete
  | ServiceUnavailable
  | ServiceRejected;

/**
 * Failures that may pass on another attempt. A writer whose answer was cut
 * off often finishes when asked again.
 */
export const isTransient = (error: MakingError) =>
  error._tag === "ServiceUnavailable" || error._tag === "ScriptIncomplete";

const SERVICE_NAMES: Record<Service, string> = {
  reader: "The article reader",
  voice: "The voice service",
  writer: "The writing service",
};

/** Why a narration failed, written for the listener. */
export const reasonFor: (error: MakingError) => string =
  Match.type<MakingError>().pipe(
    Match.tagsExhaustive({
      ArticleTooLong: ({ characters }) =>
        `This article is too long to narrate: ${characters.toLocaleString("en")} characters, and the limit is ${MAX_ARTICLE_CHARACTERS.toLocaleString("en")}.`,
      ArticleUnreadable: () =>
        "This page could not be read as an article. It may be blocked, behind a paywall, or not an article.",
      ScriptIncomplete: () =>
        "The writing service kept giving incomplete answers, even after several tries.",
      ServiceRejected: ({ service, status }) =>
        `${SERVICE_NAMES[service]} refused the request (status ${status}). Check its API key and credit.`,
      ServiceUnavailable: ({ service }) =>
        `${SERVICE_NAMES[service]} did not respond, even after several tries.`,
    })
  );

/** The reason given when a narration stops for an unexpected cause. */
export const INTERRUPTED = "Something went wrong while making this narration.";

// Failures of a request to the narrations API.

export class InvalidLink extends Schema.TaggedError<InvalidLink>()(
  "InvalidLink",
  {},
  { httpApiStatus: 400 }
) {}

export class NarrationNotFound extends Schema.TaggedError<NarrationNotFound>()(
  "NarrationNotFound",
  {},
  { httpApiStatus: 404 }
) {}

/** The narration is in the wrong state, as when removing one in progress. */
export class WrongState extends Schema.TaggedError<WrongState>()(
  "WrongState",
  {},
  { httpApiStatus: 409 }
) {}

export class TooManyInProgress extends Schema.TaggedError<TooManyInProgress>()(
  "TooManyInProgress",
  {},
  { httpApiStatus: 429 }
) {}

/** API keys or Cloudflare bindings are missing. */
export class NotConfigured extends Schema.TaggedError<NotConfigured>()(
  "NotConfigured",
  {},
  { httpApiStatus: 503 }
) {}

/** Cloudflare did not confirm that the narration started. */
export class CouldNotStart extends Schema.TaggedError<CouldNotStart>()(
  "CouldNotStart",
  {},
  { httpApiStatus: 503 }
) {}
