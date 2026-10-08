/**
 * The articles the narration eval scores. Each one is here for what it
 * tests. `bun run eval:dataset` reads them once and saves their text in a
 * private Langfuse dataset, never in git: the articles are not ours to
 * publish.
 *
 * Held-out cases are never looked at while improving the prompt. Score them
 * only to check a finished version: `bun run eval --held-out`.
 */
export interface EvalCase {
  readonly id: string;
  readonly url: string;
  readonly tests: string;
  readonly heldOut?: true;
}

export const CASES: readonly EvalCase[] = [
  {
    id: "x-article",
    tests:
      "An X article: commands in code blocks, abbreviations such as PRs, a page title that is only the site.",
    url: "https://x.com/poteto/article/2094457600259842065",
  },
  {
    id: "links-and-length",
    tests:
      "A long blog post with a link in almost every paragraph, and the site's clutter around it.",
    url: "https://simonwillison.net/2024/Dec/31/llms-in-2024/",
  },
  {
    id: "table-and-money",
    tests:
      "A government page with tables of rates, money, and dates, inside menus and cookie notices.",
    url: "https://www.gov.uk/national-minimum-wage-rates",
  },
  {
    id: "code",
    tests: "A programming article whose point depends on exact code.",
    url: "https://overreacted.io/before-you-memo/",
  },
  {
    id: "italian",
    tests:
      "An article in Italian, with references and footnote markers to leave out.",
    url: "https://it.wikipedia.org/wiki/Disgrafia",
  },
  {
    id: "formulas",
    tests: "Mathematical formulas, proofs, and figure captions.",
    url: "https://en.wikipedia.org/wiki/Euler%27s_identity",
  },
  {
    id: "long-essay",
    tests: "A very long essay with footnotes, near the length limit.",
    url: "https://paulgraham.com/greatwork.html",
  },
  {
    heldOut: true,
    id: "x-post",
    tests: "A long X post read from its post link.",
    url: "https://x.com/poteto/status/2069824386283319343",
  },
  {
    heldOut: true,
    id: "essay-with-lists",
    tests: "A blog post built around lists and short sections.",
    url: "https://jvns.ca/blog/2024/11/18/how-to-import-a-javascript-library/",
  },
];
