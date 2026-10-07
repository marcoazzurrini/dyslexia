import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ElementType, ReactNode } from "react";

import { color, font } from "./tokens.stylex.ts";

// Line heights are unitless so they scale with size. Body copy keeps 1.5,
// which dyslexia style guides recommend for running text.
const variants = stylex.create({
  body: { fontSize: font.body, fontWeight: 400, lineHeight: 1.5 },
  callout: { fontSize: font.callout, fontWeight: 400, lineHeight: 1.45 },
  caption: {
    fontSize: font.caption,
    fontWeight: 500,
    letterSpacing: "0.01em",
    lineHeight: 1.35,
  },
  footnote: { fontSize: font.footnote, fontWeight: 400, lineHeight: 1.4 },
  headline: { fontSize: font.body, fontWeight: 600, lineHeight: 1.35 },
  largeTitle: {
    fontSize: font.largeTitle,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
    textWrap: "balance",
  },
  subheadline: {
    fontSize: font.subheadline,
    fontWeight: 400,
    lineHeight: 1.4,
  },
  title1: {
    fontSize: font.title1,
    fontWeight: 700,
    letterSpacing: "-0.015em",
    lineHeight: 1.2,
    textWrap: "balance",
  },
  title2: {
    fontSize: font.title2,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    lineHeight: 1.25,
    textWrap: "balance",
  },
  title3: {
    fontSize: font.title3,
    fontWeight: 600,
    lineHeight: 1.3,
    textWrap: "balance",
  },
});

const tones = stylex.create({
  accent: { color: color.accentText },
  danger: { color: color.danger },
  inherit: { color: "inherit" },
  primary: { color: color.label },
  secondary: { color: color.secondaryLabel },
  tertiary: { color: color.tertiaryLabel },
});

export type TextVariant = keyof typeof variants;
export type TextTone = keyof typeof tones;

export interface TextProps {
  readonly children?: ReactNode;
  /** The element to render. Choose it for meaning, not looks. */
  readonly as?: ElementType;
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  readonly id?: string;
  /** Extra StyleX styles, for layout only. */
  readonly style?: StyleXStyles;
}

/** Text in one of the iOS text styles. Renders a `<p>` by default. */
export const Text = ({
  as: Element = "p",
  children,
  id,
  style,
  tone = "primary",
  variant = "body",
}: TextProps) => (
  <Element id={id} {...stylex.props(variants[variant], tones[tone], style)}>
    {children}
  </Element>
);
