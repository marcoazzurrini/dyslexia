import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { useId } from "react";

import { color, font, motion, radius, size, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  disabled: { opacity: 0.5 },
  group: {
    backgroundColor: color.fill,
    borderRadius: radius.full,
    display: "flex",
    gap: space.xxs,
    padding: "3px",
  },
  input: {
    appearance: "none",
    cursor: "inherit",
    inset: 0,
    margin: 0,
    opacity: 0,
    position: "absolute",
  },
  legend: {
    // Visually hidden; the group keeps its accessible name.
    clipPath: "inset(50%)",
    height: "1px",
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: "1px",
  },
  segment: {
    alignItems: "center",
    borderRadius: radius.full,
    color: color.label,
    cursor: "pointer",
    display: "flex",
    flexBasis: 0,
    flexGrow: 1,
    fontSize: font.subheadline,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
    justifyContent: "center",
    minHeight: size.touch,
    outlineColor: color.focus,
    outlineOffset: "-2px",
    outlineStyle: { ":focus-within": "solid", default: "none" },
    outlineWidth: "2px",
    paddingInline: space.sm,
    position: "relative",
    transitionDuration: motion.regular,
    transitionProperty: "background-color, box-shadow",
    whiteSpace: "nowrap",
  },
  selected: {
    backgroundColor: color.elevated,
    boxShadow: "0 3px 8px rgb(0 0 0 / 0.12), 0 1px 1px rgb(0 0 0 / 0.06)",
    fontWeight: 600,
  },
});

export interface SegmentedOption<Value> {
  readonly value: Value;
  readonly label: string;
}

export interface SegmentedControlProps<Value extends string | number> {
  /** The accessible name of the group, such as "Playback speed". */
  readonly label: string;
  readonly options: readonly SegmentedOption<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  readonly disabled?: boolean;
  readonly style?: StyleXStyles;
}

/**
 * Mutually exclusive choices shown side by side. Built on native radio
 * buttons, so arrow keys and screen readers work as expected.
 */
export const SegmentedControl = <Value extends string | number>({
  disabled = false,
  label,
  onChange,
  options,
  style,
  value,
}: SegmentedControlProps<Value>) => {
  const name = useId();
  return (
    <fieldset
      disabled={disabled}
      {...stylex.props(styles.group, disabled && styles.disabled, style)}
    >
      <legend {...stylex.props(styles.legend)}>{label}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            {...stylex.props(styles.segment, selected && styles.selected)}
          >
            <input
              type="radio"
              name={name}
              checked={selected}
              onChange={() => onChange(option.value)}
              {...stylex.props(styles.input)}
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
};
