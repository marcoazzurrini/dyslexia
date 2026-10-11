import * as stylex from "@stylexjs/stylex";

import { color, media, motion, radius, size, space } from "./tokens.stylex.ts";

/**
 * Looks every component shares, defined once so they cannot drift apart.
 * Components combine them with their own styles; screens never need them.
 */
export const recipes = stylex.create({
  /**
   * Scrolls sideways under the screen's margins, so items pass beneath
   * them, as Podcasts' shelves do.
   */
  bleedScroll: {
    display: "flex",
    marginInline: `calc(-1 * ${space.gutter})`,
    overflowX: "auto",
    paddingInline: space.gutter,
    scrollPaddingInline: space.gutter,
    scrollbarWidth: "none",
  },
  /**
   * A bar floating at the bottom of the screen, such as the read-along
   * controls: a glass capsule as wide as the screen allows.
   */
  bottomBar: {
    backdropFilter: {
      default: "blur(24px) saturate(180%)",
      [media.reducedTransparency]: "none",
    },
    backgroundColor: {
      default: color.glass,
      [media.reducedTransparency]: color.elevated,
    },
    borderRadius: radius.full,
    boxShadow: `inset 0 0.5px 0 ${color.glassEdge}, 0 10px 30px rgb(0 0 0 / 0.14), 0 1px 3px rgb(0 0 0 / 0.08)`,
    height: size.tabBar,
    marginInline: "auto",
    maxWidth: size.dock,
    pointerEvents: "auto",
  },
  /** Fixes a bottom bar over the content, at the same margins as the others. */
  bottomDock: {
    insetInline: 0,
    paddingInline: `max(${space.sm}, env(safe-area-inset-left))`,
    pointerEvents: "none",
    position: "fixed",
  },
  /** Two lines at most, the second ending in an ellipsis. */
  clampTwo: {
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    display: "-webkit-box",
    overflow: "hidden",
  },
  /** The keyboard focus ring, outside the control. */
  focusRing: {
    outlineColor: color.focus,
    outlineOffset: "2px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
  },
  /** The keyboard focus ring, inside the control, for edge-to-edge rows. */
  focusRingInset: {
    outlineColor: color.focus,
    outlineOffset: "-2px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
  },
  /** Feedback on press for controls: they shrink, as on iOS. */
  press: {
    touchAction: "manipulation",
    transform: {
      ":active": { default: "scale(0.96)", [media.reducedMotion]: "none" },
      default: "none",
    },
    transitionDuration: motion.fast,
    transitionProperty: "transform, background-color, color, opacity",
    transitionTimingFunction: motion.easeOut,
  },
  /** Feedback on press for large surfaces, such as cards. */
  pressSurface: {
    touchAction: "manipulation",
    transform: {
      ":active": { default: "scale(0.98)", [media.reducedMotion]: "none" },
      default: "none",
    },
    transitionDuration: motion.fast,
    transitionProperty: "transform, background-color, color, opacity",
    transitionTimingFunction: motion.easeOut,
  },
  /** One line, ending in an ellipsis. */
  truncate: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
