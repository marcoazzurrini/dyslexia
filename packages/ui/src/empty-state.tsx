import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { color, font, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  action: { marginTop: space.lg },
  description: {
    color: color.secondaryLabel,
    fontSize: font.body,
    lineHeight: 1.5,
    textWrap: "pretty",
  },
  icon: {
    color: color.tertiaryLabel,
    fontSize: "2.5rem",
    marginBottom: space.sm,
  },
  root: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    marginInline: "auto",
    maxWidth: "22rem",
    paddingBlock: space.huge,
    paddingInline: space.lg,
    textAlign: "center",
  },
  title: {
    color: color.label,
    fontSize: font.title3,
    fontWeight: 600,
    lineHeight: 1.3,
    textWrap: "balance",
  },
});

export interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** The action that fills the empty space. */
  readonly action?: ReactNode;
}

/** Explains why a screen is empty and what to do about it. */
export const EmptyState = ({
  action,
  description,
  icon,
  title,
}: EmptyStateProps) => (
  <div {...stylex.props(styles.root)}>
    {icon && <div {...stylex.props(styles.icon)}>{icon}</div>}
    <p {...stylex.props(styles.title)}>{title}</p>
    {description && <p {...stylex.props(styles.description)}>{description}</p>}
    {action && <div {...stylex.props(styles.action)}>{action}</div>}
  </div>
);
