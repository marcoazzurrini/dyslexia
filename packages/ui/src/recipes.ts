import * as stylex from "@stylexjs/stylex";

import { color, media, motion, space } from "./tokens.stylex.ts";

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
