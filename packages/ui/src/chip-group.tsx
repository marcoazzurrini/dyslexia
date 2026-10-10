import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import { recipes } from "./recipes.ts";
import type { SegmentedOption } from "./segmented-control.tsx";
import { color, font, radius, size, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  chip: {
    alignItems: "center",
    backgroundColor: {
      ":active": color.fillPressed,
      default: color.fill,
    },
    borderRadius: radius.full,
    color: color.label,
    cursor: "pointer",
    display: "flex",
    flexShrink: 0,
    fontSize: font.subheadline,
    fontWeight: 500,
    minHeight: size.touch,
    outlineColor: color.focus,
    outlineOffset: "2px",
    outlineStyle: { ":focus-within": "solid", default: "none" },
    outlineWidth: "2px",
    paddingInline: space.lg,
    position: "relative",
    scrollSnapAlign: "start",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  group: {
    gap: space.sm,
    paddingBlock: space.xxs,
    scrollSnapType: "x proximity",
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
  selected: {
    backgroundColor: {
      ":active": color.accentPressed,
      default: color.accent,
    },
    color: color.onAccent,
    fontWeight: 600,
  },
});

export interface ChipGroupProps<Value extends string> {
  /** The accessible name of the group, such as "Show". */
  readonly label: string;
  readonly options: readonly SegmentedOption<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
}

/**
 * A row of filters, one selected at a time. It scrolls sideways when the
 * labels do not fit, so it works at every text size. Built on native radio
 * buttons, so arrow keys and screen readers work as expected.
 */
export const ChipGroup = <Value extends string>({
  label,
  onChange,
  options,
  value,
}: ChipGroupProps<Value>) => {
  const name = useId();
  return (
    <fieldset {...stylex.props(recipes.bleedScroll, styles.group)}>
      <legend {...stylex.props(styles.legend)}>{label}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            {...stylex.props(
              recipes.press,
              styles.chip,
              selected && styles.selected
            )}
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
