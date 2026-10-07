import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { CheckIcon, InfoIcon, WarningIcon } from "./icons.tsx";
import { color, font, radius, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  action: {
    display: "flex",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  body: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: space.xs,
    minWidth: 0,
  },
  icon: { display: "flex", paddingTop: "0.1em" },
  notice: {
    borderRadius: radius.lg,
    color: color.label,
    display: "flex",
    gap: space.md,
    padding: space.lg,
  },
  text: {
    color: color.secondaryLabel,
    display: "flex",
    flexDirection: "column",
    fontSize: font.subheadline,
    gap: space.sm,
    lineHeight: 1.5,
  },
  title: { fontSize: font.body, fontWeight: 600, lineHeight: 1.4 },
});

const tones = stylex.create({
  danger: { backgroundColor: color.dangerFill },
  info: { backgroundColor: color.surface },
  success: { backgroundColor: color.accentFill },
  warning: { backgroundColor: color.warningFill },
});

const icons = stylex.create({
  danger: { color: color.danger },
  info: { color: color.accentText },
  success: { color: color.success },
  warning: { color: color.warning },
});

export type NoticeTone = "info" | "success" | "warning" | "danger";

export interface NoticeProps {
  readonly tone?: NoticeTone;
  readonly title: ReactNode;
  readonly children?: ReactNode;
  /** A button or link that resolves the notice. */
  readonly action?: ReactNode;
  /**
   * Announce the notice when it appears. Use it for errors that follow an
   * action, not for notices present when a screen opens.
   */
  readonly announce?: boolean;
  readonly style?: StyleXStyles;
}

const ICONS = {
  danger: <WarningIcon />,
  info: <InfoIcon />,
  success: <CheckIcon />,
  warning: <WarningIcon />,
} as const;

/** An inline message about the state of the screen. Never relies on color. */
export const Notice = ({
  action,
  announce = false,
  children,
  style,
  title,
  tone = "info",
}: NoticeProps) => (
  <div
    role={announce ? "alert" : undefined}
    {...stylex.props(styles.notice, tones[tone], style)}
  >
    <span {...stylex.props(styles.icon, icons[tone])}>{ICONS[tone]}</span>
    <div {...stylex.props(styles.body)}>
      <p {...stylex.props(styles.title)}>{title}</p>
      {children && <div {...stylex.props(styles.text)}>{children}</div>}
      {action && <div {...stylex.props(styles.action)}>{action}</div>}
    </div>
  </div>
);
