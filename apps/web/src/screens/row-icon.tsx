import { color, radius } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  tile: {
    alignItems: "center",
    borderRadius: radius.sm,
    display: "flex",
    fontSize: "0.95rem",
    height: "2rem",
    justifyContent: "center",
    width: "2rem",
  },
});

const tones = stylex.create({
  accent: { backgroundColor: color.accent, color: color.onAccent },
  danger: { backgroundColor: color.danger, color: color.onAccent },
  neutral: { backgroundColor: color.fill, color: color.accentText },
});

/** A small colored tile behind a row's icon, as in iOS Settings. */
export const RowIcon = ({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "accent" | "neutral" | "danger";
}) => (
  <span aria-hidden="true" {...stylex.props(styles.tile, tones[tone])}>
    {children}
  </span>
);
