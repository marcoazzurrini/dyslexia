import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { recipes } from "./recipes.ts";
import { color, font, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  footer: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    lineHeight: 1.4,
    paddingInline: space.lg,
  },
  // A bold heading, as content apps such as Podcasts head their sections.
  heading: {
    color: color.label,
    fontSize: font.title3,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    lineHeight: 1.35,
    paddingInline: space.xxs,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
  },
  shelf: {
    gap: space.md,
    paddingBlock: `${space.xs} ${space.lg}`,
    scrollSnapType: "x mandatory",
  },
});

export interface SectionProps {
  readonly title: string;
  readonly children: ReactNode;
  /** Help text below the content. */
  readonly footer?: string;
}

/** A group of content under a bold heading, such as a shelf of cards. */
export const Section = ({ children, footer, title }: SectionProps) => (
  <section {...stylex.props(styles.section)}>
    <h2 {...stylex.props(styles.heading)}>{title}</h2>
    {children}
    {footer && <div {...stylex.props(styles.footer)}>{footer}</div>}
  </section>
);

/** Cards or tiles side by side, scrolling sideways under the margins. */
export const Shelf = ({ children }: { readonly children: ReactNode }) => (
  <div {...stylex.props(recipes.bleedScroll, styles.shelf)}>{children}</div>
);
