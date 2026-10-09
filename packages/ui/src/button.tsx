import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

import { ActivityIndicator } from "./progress.tsx";
import {
  color,
  font,
  media,
  motion,
  radius,
  size,
  space,
} from "./tokens.stylex.ts";

const styles = stylex.create({
  base: {
    alignItems: "center",
    borderRadius: radius.md,
    borderStyle: "none",
    display: "inline-flex",
    fontFamily: font.family,
    fontWeight: 600,
    gap: space.sm,
    justifyContent: "center",
    outlineColor: color.focus,
    outlineOffset: "2px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
    textAlign: "center",
    textDecoration: "none",
    touchAction: "manipulation",
    transform: {
      ":active": { default: "scale(0.97)", [media.reducedMotion]: "none" },
      default: "none",
    },
    transitionDuration: motion.fast,
    transitionProperty: "transform, background-color, opacity",
    transitionTimingFunction: motion.easeOut,
    userSelect: "none",
  },
  block: { width: "100%" },
  disabled: {
    cursor: "not-allowed",
    opacity: 0.45,
    transform: "none",
  },
});

const sizes = stylex.create({
  large: {
    fontSize: font.body,
    minHeight: size.control,
    paddingBlock: space.md,
    paddingInline: space.xl,
  },
  medium: {
    fontSize: font.callout,
    minHeight: size.touch,
    paddingBlock: space.sm,
    paddingInline: space.lg,
  },
  small: {
    fontSize: font.subheadline,
    minHeight: "34px",
    paddingBlock: space.xs,
    paddingInline: space.md,
  },
});

const variants = stylex.create({
  destructive: {
    backgroundColor: color.dangerFill,
    color: color.danger,
    opacity: { ":active": 0.7, default: 1 },
  },
  filled: {
    backgroundColor: { ":active": color.accentPressed, default: color.accent },
    color: color.onAccent,
  },
  gray: {
    backgroundColor: { ":active": color.fillPressed, default: color.fill },
    color: color.label,
  },
  plain: {
    backgroundColor: "transparent",
    color: color.accentText,
    opacity: { ":active": 0.5, default: 1 },
  },
  tinted: {
    backgroundColor: color.accentFill,
    color: color.accentText,
    opacity: { ":active": 0.7, default: 1 },
  },
});

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

interface Appearance {
  /** `filled` is the one primary action on a screen. */
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Stretch to the container width, as for a screen's main action. */
  readonly block?: boolean;
  /** An icon before the label. */
  readonly icon?: ReactNode;
  /** Extra StyleX styles, for layout only. */
  readonly style?: StyleXStyles;
}

export interface ButtonProps
  extends Appearance, Omit<ComponentProps<"button">, "className" | "style"> {
  /** Shows progress and blocks presses, keeping the label for context. */
  readonly loading?: boolean;
}

const appearance = (
  {
    block = false,
    size: sizeName = "medium",
    style,
    variant = "filled",
  }: Appearance,
  disabled: boolean
) =>
  stylex.props(
    styles.base,
    sizes[sizeName],
    variants[variant],
    block && styles.block,
    disabled && styles.disabled,
    style
  );

/** A button. Feedback starts on press, as on iOS. */
export const Button = ({
  block,
  children,
  disabled = false,
  icon,
  loading = false,
  size: sizeName,
  style,
  type = "button",
  variant,
  ...props
}: ButtonProps) => (
  <button
    type={type === "submit" ? "submit" : "button"}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
    {...appearance(
      { block, size: sizeName, style, variant },
      disabled || loading
    )}
  >
    {loading ? <ActivityIndicator size="small" /> : icon}
    {children}
  </button>
);

export interface ButtonLinkProps
  extends Appearance, Omit<ComponentProps<"a">, "className" | "style"> {}

/**
 * A link that looks like a button, for actions that navigate. Wrap it with
 * the router's link factory to make it a router link.
 */
export const ButtonLink = ({
  block,
  children,
  icon,
  size: sizeName,
  style,
  variant,
  ...props
}: ButtonLinkProps) => (
  <a
    {...props}
    {...appearance({ block, size: sizeName, style, variant }, false)}
  >
    {icon}
    {children}
  </a>
);
