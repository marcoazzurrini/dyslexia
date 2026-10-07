import * as stylex from "@stylexjs/stylex";

// Media queries must be literals in this file: StyleX evaluates it at build
// time, before imports resolve.
const DARK = "@media (prefers-color-scheme: dark)";
const MORE_CONTRAST = "@media (prefers-contrast: more)";

/** Conditions shared by components. */
export const media = stylex.defineConsts({
  dark: "@media (prefers-color-scheme: dark)",
  hiDpi: "@media (min-resolution: 2dppx)",
  hover: "@media (hover: hover)",
  reducedMotion: "@media (prefers-reduced-motion: reduce)",
  reducedTransparency: "@media (prefers-reduced-transparency: reduce)",
});

/**
 * Semantic colors, named for their role as in iOS. Backgrounds are a soft
 * paper tone and text is never pure black: glare and harsh contrast make
 * reading harder for many dyslexic readers.
 */
export const color = stylex.defineVars({
  /** Filled controls. White text on it passes WCAG AA. */
  accent: { default: "#1d6a46", [DARK]: "#2b8a5c" },
  /** Tinted button background. */
  accentFill: {
    default: "rgb(29 106 70 / 0.12)",
    [DARK]: "rgb(111 216 164 / 0.16)",
  },
  /** Pressed state of filled controls. */
  accentPressed: { default: "#14533a", [DARK]: "#247550" },
  /** Tinted text and icons on any background. */
  accentText: { default: "#1d6a46", [DARK]: "#6fd8a4" },
  background: { default: "#f3f1ea", [DARK]: "#0b0c0b" },
  danger: { default: "#b3261e", [DARK]: "#ff7a6e" },
  dangerFill: {
    default: "rgb(179 38 30 / 0.1)",
    [DARK]: "rgb(255 122 110 / 0.14)",
  },
  /** Sheets, which sit above the background. */
  elevated: { default: "#fcfbf7", [DARK]: "#1b1c1a" },
  /** Gray control fills, such as the gray button and switch track. */
  fill: {
    default: "rgb(120 120 112 / 0.16)",
    [DARK]: "rgb(120 120 112 / 0.32)",
  },
  fillPressed: {
    default: "rgb(120 120 112 / 0.28)",
    [DARK]: "rgb(120 120 112 / 0.44)",
  },
  focus: { default: "#1d6a46", [DARK]: "#6fd8a4" },
  /** Translucent chrome over scrolling content. */
  glass: {
    default: "rgb(252 251 247 / 0.72)",
    [DARK]: "rgb(30 31 29 / 0.66)",
  },
  glassEdge: {
    default: "rgb(255 255 255 / 0.7)",
    [DARK]: "rgb(255 255 255 / 0.1)",
  },
  label: { default: "#1d211f", [DARK]: "#eceae4" },
  onAccent: "#ffffff",
  scrim: { default: "rgb(18 20 19 / 0.32)", [DARK]: "rgb(0 0 0 / 0.56)" },
  secondaryLabel: {
    default: "rgb(45 52 48 / 0.72)",
    [DARK]: "rgb(236 234 228 / 0.68)",
    [MORE_CONTRAST]: "rgb(29 33 31 / 0.9)",
  },
  separator: {
    default: "rgb(45 52 48 / 0.18)",
    [DARK]: "rgb(236 234 228 / 0.16)",
  },
  success: { default: "#1d6a46", [DARK]: "#6fd8a4" },
  /** Cells and cards on the background. */
  surface: { default: "#fcfbf7", [DARK]: "#1b1c1a" },
  surfacePressed: { default: "#e6e3da", [DARK]: "#2c2d2a" },
  tertiaryLabel: {
    default: "rgb(45 52 48 / 0.46)",
    [DARK]: "rgb(236 234 228 / 0.42)",
  },
  warning: { default: "#8a5a00", [DARK]: "#ffc95c" },
  warningFill: {
    default: "rgb(176 115 0 / 0.12)",
    [DARK]: "rgb(255 201 92 / 0.14)",
  },
});

/** A 4-point spacing scale in rem, so it grows with the reader's text size. */
export const space = stylex.defineVars({
  /** Side margin of screen content, as in iOS. */
  gutter: "1.25rem",
  huge: "3rem",
  lg: "1rem",
  md: "0.75rem",
  sm: "0.5rem",
  xl: "1.25rem",
  xs: "0.25rem",
  xxl: "1.5rem",
  xxs: "0.125rem",
  xxxl: "2rem",
});

export const radius = stylex.defineVars({
  full: "999px",
  /** Inset grouped list sections. */
  lg: "1.375rem",
  md: "0.75rem",
  sm: "0.5rem",
  /** Sheets. */
  xl: "2.25rem",
});

/**
 * iOS text styles, relative to the body size. On iPhone the root size
 * follows the system text size setting, so every style scales with it.
 */
export const font = stylex.defineVars({
  body: "1rem",
  callout: "0.94rem",
  caption: "0.75rem",
  family:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  footnote: "0.8rem",
  largeTitle: "2rem",
  subheadline: "0.88rem",
  title1: "1.65rem",
  title2: "1.3rem",
  title3: "1.18rem",
});

/** Fixed sizes for controls, which iOS does not scale with text. */
export const size = stylex.defineVars({
  control: "50px",
  /** Readable line length for long text. */
  measure: "40rem",
  navBar: "52px",
  /** The smallest comfortable touch target. */
  touch: "44px",
});

/**
 * Motion. `spring` approximates a critically damped spring with a 0.35s
 * response, which settles without overshoot.
 */
export const motion = stylex.defineVars({
  easeOut: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  fast: "120ms",
  regular: "240ms",
  slow: "500ms",
  spring:
    "linear(0, 0.227, 0.536, 0.75, 0.873, 0.938, 0.971, 0.986, 0.994, 0.997, 1)",
});
