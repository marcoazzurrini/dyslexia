import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { color } from "./tokens.stylex.ts";

/**
 * Cover colors, deep enough that white text on each passes WCAG AA. None
 * is the indigo tint, which marks only what can be pressed.
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
 * The color of a cover, from a hash of its seed, so the same seed always
 * gets the same color. Fibonacci hashing spreads seeds that share an
 * ending, such as ".com", across the colors.
 */
export const coverTint = (seed: string) => {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 131 + (char.codePointAt(0) ?? 0)) % 1_000_000_007;
  }
  const spread = (hash * GOLDEN_RATIO) % 1;
  return HUES[Math.floor(spread * HUES.length)] ?? HUES[0];
};

// Sizes follow the box the cover fills, so the component holding it decides
// how large it is; text scales with it, through container units.
const ROOMY = "@container (min-width: 4rem)";
const NAMED = "@container (min-width: 7rem)";

const styles = stylex.create({
  cover: {
    alignItems: "center",
    aspectRatio: "1",
    color: color.onAccent,
    containerType: "inline-size",
    display: "flex",
    fontWeight: 700,
    justifyContent: "center",
    lineHeight: 1,
    overflow: "hidden",
    position: "relative",
    userSelect: "none",
    width: "100%",
  },
  danger: { backgroundColor: color.dangerFill, color: color.danger },
  hue: (hue: string) => ({ backgroundColor: hue }),
  initial: {
    display: "flex",
    fontSize: { default: "44cqi", [NAMED]: "36cqi" },
    position: "relative",
  },
  // Light falling from the top, where a flat fill would read as a
  // placeholder.
  light: {
    backgroundImage: {
      default: "none",
      [ROOMY]:
        "linear-gradient(160deg, rgb(255 255 255 / 0.22), transparent 72%)",
    },
    inset: 0,
    position: "absolute",
  },
  // The name, set at the lower left, as on Apple's generated covers.
  name: {
    bottom: "8%",
    display: { default: "none", [NAMED]: "block" },
    fontSize: "clamp(0.75rem, 7cqi, 1.0625rem)",
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
});

export interface CoverProps {
  /** Picks the color: the same seed always gets the same one. */
  readonly seed: string;
  /** Its initial stands on the cover, and the whole name when there is room. */
  readonly name: string;
  /** Gray or red, for something not ready. */
  readonly tone?: "neutral" | "danger";
  /** Replaces the initial, such as an icon for something not ready. */
  readonly children?: ReactNode;
}

/**
 * Stands in for cover art: a square in a color of its own, with an
 * initial. It fills the width it is given; the component that holds it
 * sets its size, corners, and shadow.
 */
export const Cover = ({ children, name, seed, tone }: CoverProps) => (
  <span
    aria-hidden="true"
    {...stylex.props(
      styles.cover,
      tone ? styles[tone] : styles.hue(coverTint(seed))
    )}
  >
    {!tone && <span {...stylex.props(styles.light)} />}
    <span {...stylex.props(styles.initial)}>
      {children ?? name.charAt(0).toUpperCase()}
    </span>
    {!children && <span {...stylex.props(styles.name)}>{name}</span>}
  </span>
);
