import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useId } from "react";

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
  description: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    lineHeight: 1.4,
  },
  disabled: { cursor: "not-allowed", opacity: 0.5 },
  input: {
    appearance: "none",
    borderRadius: radius.full,
    cursor: "inherit",
    inset: 0,
    margin: 0,
    outlineColor: color.focus,
    outlineOffset: "2px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
    position: "absolute",
  },
  knob: {
    backgroundColor: "#ffffff",
    borderRadius: radius.full,
    boxShadow: "0 3px 8px rgb(0 0 0 / 0.15), 0 1px 1px rgb(0 0 0 / 0.16)",
    height: "27px",
    insetBlockStart: "2px",
    insetInlineStart: "2px",
    pointerEvents: "none",
    position: "absolute",
    transitionDuration: { default: motion.slow, [media.reducedMotion]: "0s" },
    transitionProperty: "transform",
    transitionTimingFunction: motion.spring,
    width: "27px",
  },
  knobOn: { transform: "translateX(20px)" },
  label: { fontSize: font.body, lineHeight: 1.4 },
  row: {
    alignItems: "center",
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    color: color.label,
    cursor: "pointer",
    display: "flex",
    gap: space.lg,
    minHeight: size.touch,
    paddingBlock: space.md,
    paddingInline: space.lg,
  },
  text: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: space.xxs,
  },
  track: {
    backgroundColor: color.fill,
    borderRadius: radius.full,
    flexShrink: 0,
    height: "31px",
    position: "relative",
    transitionDuration: motion.regular,
    transitionProperty: "background-color",
    width: "51px",
  },
  trackOn: { backgroundColor: color.accent },
});

export interface SwitchProps {
  readonly label: ReactNode;
  /** Help text under the label. */
  readonly description?: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
}

/**
 * An iOS switch in an inset cell, for an immediate on or off choice. The
 * whole row is the touch target.
 */
export const Switch = ({
  checked,
  description,
  disabled = false,
  label,
  onChange,
  required,
}: SwitchProps) => {
  const id = useId();
  return (
    <label
      htmlFor={id}
      {...stylex.props(styles.row, disabled && styles.disabled)}
    >
      <span {...stylex.props(styles.text)}>
        <span {...stylex.props(styles.label)}>{label}</span>
        {description && (
          <span {...stylex.props(styles.description)}>{description}</span>
        )}
      </span>
      <span {...stylex.props(styles.track, checked && styles.trackOn)}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          required={required}
          onChange={(event) => onChange(event.target.checked)}
          {...stylex.props(styles.input)}
        />
        <span {...stylex.props(styles.knob, checked && styles.knobOn)} />
      </span>
    </label>
  );
};
