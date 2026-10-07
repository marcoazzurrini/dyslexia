/** Every limit that shapes what a narration may cost or contain. */

/**
 * The longest article that will be narrated, counted in characters of the
 * text extracted from the page. Speech costs about $0.08 per 1,000
 * characters, so this caps one narration at about $8.
 */
export const MAX_ARTICLE_CHARACTERS = 100_000;

/** Reading aloud can need a few more words, such as spelled-out symbols. */
export const MAX_SCRIPT_CHARACTERS = 125_000;

/** The most text sent to the voice service in one request. */
export const MAX_PART_CHARACTERS = 3000;

/** Parts recorded at the same time. */
export const PARTS_AT_ONCE = 2;

/** Narrations that may be in progress at once. */
export const MAX_IN_PROGRESS = 5;

/** Extra attempts after a failure that may pass, such as a network error. */
export const RETRIES = 3;

/** Narrations listed in the library, newest first. */
export const MAX_LISTED = 50;
