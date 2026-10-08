// The sites Firecrawl only reads well with some help, and that help. Every
// site-specific detail of reading belongs here, so the rest of the code never
// asks which site a link is on.

/** Help for one site. */
interface SiteRule {
  /** Why the site needs help, so the rule can go once it no longer does. */
  readonly reason: string;
  /** The link to hand Firecrawl instead, or `undefined` to leave it alone. */
  readonly linkToRead: (url: URL) => string | undefined;
}

const xArticle = /^\/(?<user>\w+)\/article\/(?<id>\d+)\/?$/u;

const RULES: readonly SiteRule[] = [
  {
    linkToRead: (url) => {
      if (!/^(?:(?:www|mobile)\.)?(?:x|twitter)\.com$/u.test(url.hostname)) {
        return;
      }
      const { id, user } = xArticle.exec(url.pathname)?.groups ?? {};
      // An `/i/article/` link names the article, not its post.
      return user && id && user !== "i"
        ? `https://x.com/${user}/status/${id}`
        : undefined;
    },
    reason:
      "Firecrawl reads X posts but refuses X article links. An article's link names the post it was published in, and that post holds the whole article.",
  },
];

/** The link Firecrawl should read for an article link. */
export const linkToRead = (link: string) => {
  const url = new URL(link);
  for (const rule of RULES) {
    const replacement = rule.linkToRead(url);
    if (replacement !== undefined) {
      return replacement;
    }
  }
  return link;
};
