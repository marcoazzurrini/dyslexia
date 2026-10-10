import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

import { recipes } from "./recipes.ts";
import { color, media, radius, size } from "./tokens.stylex.ts";

const styles = stylex.create({
  base: {
    alignItems: "center",
    borderRadius: radius.full,
    borderStyle: "none",
    display: "inline-flex",
    flexShrink: 0,
    fontSize: "1.0625rem",
    height: size.touch,
    justifyContent: "center",
    padding: 0,
    textDecoration: "none",
    width: size.touch,
  },
  disabled: { cursor: "not-allowed", opacity: 0.4, transform: "none" },
  large: { fontSize: "1.75rem", height: "4.5rem", width: "4.5rem" },
  // A small circle beside a row's text, as Audible's play button. Its touch
  // area stays the full 44px.
  small: {
    "::before": {
      content: "''",
      inset: `calc((1.5rem - ${size.touch}) / 2)`,
      position: "absolute",
    },
    fontSize: "0.625rem",
    height: "1.5rem",
    position: "relative",
    width: "1.5rem",
  },
});

const variants = stylex.create({
  filled: {
    backgroundColor: { ":active": color.accentPressed, default: color.accent },
    color: color.onAccent,
  },
  glass: {
    backdropFilter: {
      default: "blur(16px) saturate(180%)",
      [media.reducedTransparency]: "none",
    },
    backgroundColor: {
      default: color.glass,
      [media.reducedTransparency]: color.surface,
    },
    boxShadow: `inset 0 0.5px 0 ${color.glassEdge}, 0 2px 10px rgb(0 0 0 / 0.08)`,
    color: color.label,
  },
  gray: {
    backgroundColor: { ":active": color.fillPressed, default: color.fill },
    color: color.label,
  },
  // A thin ring around the glyph, as Audible's play button.
  outline: {
    backgroundColor: "transparent",
    borderColor: color.separator,
    borderStyle: "solid",
    borderWidth: "1px",
    color: color.label,
    opacity: { ":active": 0.5, default: 1 },
  },
  plain: {
    backgroundColor: "transparent",
    color: color.label,
    opacity: { ":active": 0.5, default: 1 },
  },
  // A bare glyph in the tint, as iOS shows actions in a navigation bar.
  tinted: {
    backgroundColor: "transparent",
    color: color.accentText,
    fontSize: "1.5rem",
    opacity: { ":active": 0.5, default: 1 },
  },
});

export type IconButtonVariant = keyof typeof variants;

interface Appearance {
  /** The accessible name. Icons are never announced. */
  readonly label: string;
  readonly icon: ReactNode;
  /** `glass` floats over content, as in iOS toolbars. */
  readonly variant?: IconButtonVariant;
  readonly size?: "small" | "regular" | "large";
  readonly style?: StyleXStyles;
}

export interface IconButtonProps
  extends
    Appearance,
    Omit<ComponentProps<"button">, "className" | "style" | "children"> {}

const appearance = (
  { size: sizeName = "regular", style, variant = "glass" }: Appearance,
  disabled: boolean
) =>
  stylex.props(
    recipes.focusRing,
    recipes.press,
    styles.base,
    variants[variant],
    sizeName === "large" && styles.large,
    sizeName === "small" && styles.small,
    disabled && styles.disabled,
    style
  );

/** A round button that shows only an icon. */
export const IconButton = ({
  disabled = false,
  icon,
  label,
  size: sizeName,
  style,
  type = "button",
  variant,
  ...props
}: IconButtonProps) => (
  <button
    type={type === "submit" ? "submit" : "button"}
    aria-label={label}
    disabled={disabled}
    {...props}
    {...appearance({ icon, label, size: sizeName, style, variant }, disabled)}
  >
    {icon}
  </button>
);

export interface IconLinkProps
  extends
    Appearance,
    Omit<ComponentProps<"a">, "className" | "style" | "children"> {}

/** A round link that shows only an icon, such as a back button. */
export const IconLink = ({
  icon,
  label,
  size: sizeName,
  style,
  variant,
  ...props
}: IconLinkProps) => (
  <a
    aria-label={label}
    {...props}
    {...appearance({ icon, label, size: sizeName, style, variant }, false)}
  >
    {icon}
  </a>
);
