import { color, font, media, motion, radius } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { siteOf } from "../lib/recording";

/**
 * Cover colors, deep enough that white text on each passes WCAG AA. A site
 * always gets the same one, so its narrations are easy to spot. None is the
 * indigo tint, which marks only what can be pressed.
 */
const HUES = [
  "#0062c4",
  "#00727a",
  "#2b7a35",
  "#b8440f",
  "#b5245f",
  "#8a2aa6",
  "#86532a",
  "#4a5868",
] as const;

/** The fractional part of the golden ratio, for Fibonacci hashing. */
const GOLDEN_RATIO = (Math.sqrt(5) - 1) / 2;

/**
 * The cover color of a site, from a hash of its name. Fibonacci hashing
 * spreads names that share an ending, such as ".com", across the colors.
 */
export const hueOf = (site: string) => {
  let hash = 0;
  for (const char of site) {
    hash = (hash * 131 + (char.codePointAt(0) ?? 0)) % 1_000_000_007;
  }
  const spread = (hash * GOLDEN_RATIO) % 1;
  return HUES[Math.floor(spread * HUES.length)] ?? HUES[0];
};

/** The site's name without its domain ending, such as "stilldrinking". */
const nameOf = (site: string) => site.split(".").slice(0, -1).join(".") || site;

const styles = stylex.create({
  // Leads the card on Home, over a darker shade of its own color.
  card: {
    borderRadius: radius.md,
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.24)",
    fontSize: "1.875rem",
    height: "4.25rem",
    width: "4.25rem",
  },
  cover: {
    alignItems: "center",
    color: color.onAccent,
    display: "flex",
    flexShrink: 0,
    fontWeight: 700,
    justifyContent: "center",
    lineHeight: 1,
    overflow: "hidden",
    position: "relative",
    userSelect: "none",
  },
  danger: { backgroundColor: color.dangerFill, color: color.danger },
  hue: (hue: string) => ({ backgroundColor: hue }),
  large: {
    aspectRatio: "1",
    borderRadius: "1.25rem",
    boxShadow: "0 14px 36px rgb(0 0 0 / 0.24), 0 2px 6px rgb(0 0 0 / 0.12)",
    fontSize: "6.5rem",
    marginInline: "auto",
    maxWidth: "17rem",
    transformOrigin: "50% 50%",
    transitionDuration: motion.slow,
    transitionProperty: "transform, box-shadow",
    transitionTimingFunction: motion.spring,
    // Smaller on short screens, so the controls stay in view.
    width: "min(78%, 38vh)",
  },
  largeName: { fontSize: "1.0625rem" },
  // As in Podcasts, the cover steps back while paused.
  largePaused: {
    boxShadow: "0 6px 18px rgb(0 0 0 / 0.16), 0 1px 3px rgb(0 0 0 / 0.1)",
    transform: { default: "scale(0.84)", [media.reducedMotion]: "none" },
  },
  // Light falling from the top, within the cover's own color, at sizes
  // where a flat fill would read as a placeholder.
  lit: (hue: string) => ({
    backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${hue} 78%, white), ${hue} 72%)`,
  }),
  mini: {
    borderRadius: radius.sm,
    fontSize: "1.25rem",
    height: "2.75rem",
    width: "2.75rem",
  },
  // The site's name, set at the lower left, as on Apple's generated covers.
  name: {
    bottom: "8%",
    fontWeight: 700,
    insetInline: "9%",
    letterSpacing: "-0.01em",
    lineHeight: 1.25,
    opacity: 0.92,
    overflow: "hidden",
    position: "absolute",
    textAlign: "start",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  neutral: { backgroundColor: color.fill, color: color.secondaryLabel },
  row: {
    borderRadius: "0.625rem",
    fontSize: "1.5rem",
    height: "3.5rem",
    width: "3.5rem",
  },
  shelf: {
    aspectRatio: "1",
    borderRadius: radius.md,
    boxShadow: "0 6px 16px rgb(0 0 0 / 0.14), 0 1px 3px rgb(0 0 0 / 0.08)",
    fontSize: "3.25rem",
    width: "100%",
  },
  shelfName: { fontSize: font.footnote },
});

export type CoverSize = "row" | "mini" | "card" | "shelf" | "large";

/**
 * Stands in for cover art, which narrations do not have: a square in the
 * site's color with its initial and, when large, its name. `children` replaces the initial, as for a
 * narration being made or one that failed.
 */
export const Cover = ({
  children,
  paused = false,
  size,
  tone,
  url,
}: {
  url: string;
  size: CoverSize;
  /** Steps the large cover back, while playback is paused. */
  paused?: boolean;
  /** A gray or red cover for narrations that are not ready. */
  tone?: "neutral" | "danger";
  children?: ReactNode;
}) => {
  const site = siteOf(url);
  const hue = hueOf(site);
  const big = size === "shelf" || size === "card" || size === "large";
  const named = !children && (size === "shelf" || size === "large");
  return (
    <span
      aria-hidden="true"
      {...stylex.props(
        styles.cover,
        tone ? styles[tone] : styles.hue(hue),
        !tone && big && styles.lit(hue),
        styles[size],
        size === "large" && paused && styles.largePaused
      )}
    >
      {children ?? nameOf(site).charAt(0).toUpperCase()}
      {named && (
        <span
          {...stylex.props(
            styles.name,
            size === "large" ? styles.largeName : styles.shelfName
          )}
        >
          {nameOf(site)}
        </span>
      )}
    </span>
  );
};
