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
 * Semantic colors, named for their role as in iOS and close to its system
 * colors, so Reader sits beside Apple's own apps. Text is never pure black or
 * pure white: glare and harsh contrast make reading harder for many dyslexic
 * readers.
 */
export const color = stylex.defineVars({
  /** Filled controls. White text on it passes WCAG AA. */
  accent: { default: "#5856d6", [DARK]: "#5e5ce6" },
  /** Tinted button background. */
  accentFill: {
    default: "rgb(88 86 214 / 0.12)",
    [DARK]: "rgb(125 122 255 / 0.18)",
  },
  /** Pressed state of filled controls. */
  accentPressed: { default: "#4644b8", [DARK]: "#4c4ad0" },
  /** Tinted text and icons on any background. */
  accentText: { default: "#4f4dcc", [DARK]: "#8e8cff" },
  /** Behind grouped lists, such as settings. */
  background: { default: "#f2f2f7", [DARK]: "#0d0d0f" },
  /**
   * Behind plain content, such as narrations and shelves. Lighter than the
   * grouped gray but well off white, so a full screen of it does not glare.
   */
  canvas: { default: "#f7f7f9", [DARK]: "#0d0d0f" },
  danger: { default: "#d70015", [DARK]: "#ff6961" },
  dangerFill: {
    default: "rgb(215 0 21 / 0.1)",
    [DARK]: "rgb(255 105 97 / 0.16)",
  },
  /** Behind white text on destructive actions, such as a swiped Delete. */
  destructive: { default: "#d70015", [DARK]: "#d83a34" },
  /** Sheets, which sit above the background. */
  elevated: { default: "#f2f2f7", [DARK]: "#1c1c1e" },
  /** Gray control fills, such as the gray button and switch track. */
  fill: {
    default: "rgb(118 118 128 / 0.12)",
    [DARK]: "rgb(118 118 128 / 0.24)",
  },
  fillPressed: {
    default: "rgb(118 118 128 / 0.24)",
    [DARK]: "rgb(118 118 128 / 0.36)",
  },
  focus: { default: "#5856d6", [DARK]: "#8e8cff" },
  /**
   * Chrome over scrolling content, such as the tab bar and mini player.
   * Opaque: text passing underneath must never show through text on it.
   */
  glass: { default: "#f7f7f9", [DARK]: "#1f1f22" },
  glassEdge: {
    default: "rgb(255 255 255 / 0.8)",
    [DARK]: "rgb(255 255 255 / 0.1)",
  },
  label: { default: "#1c1c1e", [DARK]: "#ececf1" },
  onAccent: "#ffffff",
  scrim: { default: "rgb(0 0 0 / 0.3)", [DARK]: "rgb(0 0 0 / 0.6)" },
  secondaryLabel: {
    default: "rgb(60 60 67 / 0.78)",
    [DARK]: "rgb(235 235 245 / 0.68)",
    [MORE_CONTRAST]: "rgb(28 28 30 / 0.92)",
  },
  separator: {
    default: "rgb(60 60 67 / 0.2)",
    [DARK]: "rgb(84 84 88 / 0.6)",
  },
  success: { default: "#248a3d", [DARK]: "#30d158" },
  /** Cells and cards on the background. */
  surface: { default: "#ffffff", [DARK]: "#1c1c1e" },
  surfacePressed: { default: "#e5e5ea", [DARK]: "#2c2c2e" },
  tertiaryLabel: {
    default: "rgb(60 60 67 / 0.5)",
    [DARK]: "rgb(235 235 245 / 0.4)",
  },
  /** The raised part of a control, such as a segmented control's thumb. */
  thumb: { default: "#ffffff", [DARK]: "#636366" },
  warning: { default: "#b25000", [DARK]: "#ffb340" },
  warningFill: {
    default: "rgb(178 80 0 / 0.12)",
    [DARK]: "rgb(255 179 64 / 0.16)",
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
  /** Inset grouped list sections and cards. */
  lg: "0.875rem",
  md: "0.625rem",
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
  /** The widest the floating bars at the bottom of the screen get. */
  dock: "28rem",
  /** Readable line length for long text. */
  measure: "40rem",
  navBar: "52px",
  /** The floating tab bar at the bottom of the screen. */
  tabBar: "62px",
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
