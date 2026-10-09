import * as stylex from "@stylexjs/stylex";

import { color, media, radius } from "./tokens.stylex.ts";

const SPOKES = Array.from({ length: 8 }, (_, index) => index);

const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const pulse = stylex.keyframes({
  "0%, 100%": { opacity: 0.35 },
  "50%": { opacity: 1 },
});

const styles = stylex.create({
  // Native progress, restyled in each engine's own pseudo-elements.
  bar: {
    "::-moz-progress-bar": {
      backgroundColor: color.accent,
      borderRadius: radius.full,
    },
    "::-webkit-progress-bar": {
      backgroundColor: color.fill,
      borderRadius: radius.full,
    },
    "::-webkit-progress-value": {
      backgroundColor: color.accent,
      borderRadius: radius.full,
      transitionDuration: "400ms",
      transitionProperty: "width",
    },
    appearance: "none",
    backgroundColor: color.fill,
    borderRadius: radius.full,
    borderStyle: "none",
    display: "block",
    height: "6px",
    overflow: "hidden",
    width: "100%",
  },
  indicator: {
    color: color.secondaryLabel,
    display: "inline-block",
    flexShrink: 0,
    height: "1.25em",
    width: "1.25em",
  },
  large: { height: "2.25rem", width: "2.25rem" },
  // White on a colored surface, such as a card in a cover's color.
  onColor: {
    "::-moz-progress-bar": { backgroundColor: color.onAccent },
    "::-webkit-progress-bar": { backgroundColor: "rgb(255 255 255 / 0.3)" },
    "::-webkit-progress-value": { backgroundColor: color.onAccent },
    backgroundColor: "rgb(255 255 255 / 0.3)",
  },
  svg: {
    animationDuration: { default: "0.9s", [media.reducedMotion]: "1.6s" },
    animationIterationCount: "infinite",
    animationName: { default: spin, [media.reducedMotion]: pulse },
    animationTimingFunction: {
      default: "steps(8)",
      [media.reducedMotion]: "ease-in-out",
    },
    height: "100%",
    width: "100%",
  },
  thin: { height: "4px" },
});

export interface ActivityIndicatorProps {
  readonly size?: "small" | "large";
  /** Announced to screen readers. Omit when nearby text says what is loading. */
  readonly label?: string;
}

/** The iOS spinner, for waits of unknown length. */
export const ActivityIndicator = ({
  label,
  size = "small",
}: ActivityIndicatorProps) => (
  <span
    role={label ? "status" : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    {...stylex.props(styles.indicator, size === "large" && styles.large)}
  >
    <svg viewBox="0 0 24 24" {...stylex.props(styles.svg)}>
      {SPOKES.map((spoke) => (
        <rect
          key={spoke}
          x="11"
          y="2"
          width="2"
          height="6"
          rx="1"
          fill="currentColor"
          opacity={0.25 + (spoke / SPOKES.length) * 0.75}
          transform={`rotate(${spoke * 45} 12 12)`}
        />
      ))}
    </svg>
  </span>
);

export interface ProgressBarProps {
  readonly value: number;
  readonly max: number;
  /** The accessible name, such as "Speech segments". */
  readonly label: string;
  /** `thin` sits inside a list row, under its text. */
  readonly size?: "regular" | "thin";
  /** `onColor` is white, for a colored surface. */
  readonly tone?: "accent" | "onColor";
}

/** A determinate progress bar. */
export const ProgressBar = ({
  label,
  max,
  size = "regular",
  tone = "accent",
  value,
}: ProgressBarProps) => (
  <progress
    aria-label={label}
    max={max}
    value={Math.min(value, max)}
    {...stylex.props(
      styles.bar,
      size === "thin" && styles.thin,
      tone === "onColor" && styles.onColor
    )}
  />
);
