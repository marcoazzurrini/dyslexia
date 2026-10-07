import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { CheckIcon, CloseIcon } from "./icons.tsx";
import { ActivityIndicator } from "./progress.tsx";
import { color, font, radius, size, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  label: { flexGrow: 1, fontSize: font.body, lineHeight: 1.35 },
  list: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    display: "flex",
    flexDirection: "column",
    paddingBlock: space.sm,
  },
  mark: {
    alignItems: "center",
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: "2px",
    display: "flex",
    flexShrink: 0,
    fontSize: font.caption,
    height: "1.75rem",
    justifyContent: "center",
    width: "1.75rem",
  },
  state: { fontSize: font.subheadline },
  step: {
    alignItems: "center",
    display: "flex",
    gap: space.md,
    minHeight: size.touch,
    paddingInline: space.lg,
  },
});

const marks = stylex.create({
  current: { borderColor: "transparent", color: color.accentText },
  done: {
    backgroundColor: color.accent,
    borderColor: color.accent,
    color: color.onAccent,
  },
  failed: {
    backgroundColor: color.danger,
    borderColor: color.danger,
    color: color.onAccent,
  },
  upcoming: { borderColor: color.separator },
  waiting: { borderColor: color.accentText, color: color.accentText },
});

const labels = stylex.create({
  current: { color: color.label, fontWeight: 600 },
  done: { color: color.secondaryLabel },
  failed: { color: color.danger, fontWeight: 600 },
  upcoming: { color: color.tertiaryLabel },
  waiting: { color: color.accentText, fontWeight: 600 },
});

export type StepState = "done" | "current" | "waiting" | "upcoming" | "failed";

export interface Step {
  readonly label: string;
  readonly state: StepState;
}

export interface StepListProps {
  /** The accessible name, such as "Narration progress". */
  readonly label: string;
  readonly steps: readonly Step[];
}

// Screen readers hear the state, which the marks only show.
const STATE_TEXT: Record<StepState, string> = {
  current: "In progress",
  done: "Done",
  failed: "Stopped",
  upcoming: "",
  waiting: "Needs you",
};

const MARKS: Record<StepState, ReactNode> = {
  current: <ActivityIndicator />,
  done: <CheckIcon />,
  failed: <CloseIcon />,
  upcoming: null,
  waiting: null,
};

/** The stages of a long task, with the current one highlighted. */
export const StepList = ({ label, steps }: StepListProps) => (
  <ol aria-label={label} {...stylex.props(styles.list)}>
    {steps.map((step) => (
      <li
        key={step.label}
        aria-current={
          step.state === "current" || step.state === "waiting"
            ? "step"
            : undefined
        }
        {...stylex.props(styles.step)}
      >
        <span {...stylex.props(styles.mark, marks[step.state])}>
          {MARKS[step.state]}
        </span>
        <span {...stylex.props(styles.label, labels[step.state])}>
          {step.label}
        </span>
        {STATE_TEXT[step.state] && (
          <span {...stylex.props(styles.state, labels[step.state])}>
            {STATE_TEXT[step.state]}
          </span>
        )}
      </li>
    ))}
  </ol>
);
