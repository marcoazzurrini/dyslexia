import { Effect } from "effect";

import { InvalidLink } from "./errors.ts";

const hostnameLabel = /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/u;
const privateSuffix =
  /(?:^|\.)(?:localhost|localdomain|local|internal|intranet|lan|home|corp|private|example|test|invalid|onion|arpa)$/u;

const parse = (value: string): string | undefined => {
  if (!/^https:\/\//iu.test(value) || /[\s\\]/u.test(value)) {
    return;
  }
  const authority = value.slice(8).split(/[/?#]/u)[0] ?? "";
  if (!authority || authority.includes("@") || authority.endsWith(":")) {
    return;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return;
  }
  const hostname = url.hostname.replace(/\.$/u, "");
  const labels = hostname.split(".");
  if (
    url.username ||
    url.password ||
    url.port ||
    hostname.length > 253 ||
    labels.length < 2 ||
    labels.some((label) => !hostnameLabel.test(label)) ||
    /^\d+$/u.test(labels.at(-1) ?? "") ||
    privateSuffix.test(hostname)
  ) {
    return;
  }
  url.hostname = hostname;
  url.hash = "";
  return url.href;
};

/**
 * The article link in a standard form: public HTTPS on the default port,
 * with no credentials and no fragment. This checks the link's form only; the
 * article reader fetches the page and must refuse private destinations.
 */
export const normalizeLink = (
  value: string
): Effect.Effect<string, InvalidLink> => {
  const link = parse(value.trim());
  return link === undefined
    ? Effect.fail(new InvalidLink())
    : Effect.succeed(link);
};
