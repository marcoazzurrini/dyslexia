import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { color, font, radius, size, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  control: {
    "::placeholder": { color: color.tertiaryLabel },
    backgroundColor: color.surface,
    borderColor: { ":focus": color.focus, default: "transparent" },
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "2px",
    color: color.label,
    // iOS zooms into inputs with text smaller than 16px.
    fontSize: `max(16px, ${font.body})`,
    lineHeight: 1.4,
    minHeight: size.control,
    outlineStyle: "none",
    paddingBlock: space.md,
    paddingInline: `calc(${space.lg} - 2px)`,
    transitionDuration: "150ms",
    transitionProperty: "border-color",
    width: "100%",
  },
  error: { color: color.danger },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
  },
  hint: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    lineHeight: 1.4,
    paddingInline: space.lg,
  },
  invalid: { borderColor: color.danger },
  label: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    fontWeight: 600,
    lineHeight: 1.35,
    paddingInline: space.lg,
  },
  multiline: {
    letterSpacing: "0.01em",
    lineHeight: 1.6,
    minHeight: "12rem",
    resize: "vertical",
    wordSpacing: "0.05em",
  },
});

interface FieldProps {
  readonly label: ReactNode;
  /** Help text under the field. */
  readonly description?: ReactNode;
  /** Replaces the description and marks the field invalid. */
  readonly error?: ReactNode;
  readonly style?: StyleXStyles;
}

const useField = (
  { description, error }: FieldProps,
  given: string | undefined
) => {
  const generated = useId();
  const id = given ?? generated;
  let hint: string | undefined;
  if (error) {
    hint = `${id}-error`;
  } else if (description) {
    hint = `${id}-hint`;
  }
  return { hint, id };
};

const Frame = ({
  children,
  description,
  error,
  hint,
  id,
  label,
  style,
}: FieldProps & { children: ReactNode; hint?: string; id: string }) => (
  <div {...stylex.props(styles.field, style)}>
    <label htmlFor={id} {...stylex.props(styles.label)}>
      {label}
    </label>
    {children}
    {error ? (
      <p id={hint} role="alert" {...stylex.props(styles.hint, styles.error)}>
        {error}
      </p>
    ) : (
      description && (
        <p id={hint} {...stylex.props(styles.hint)}>
          {description}
        </p>
      )
    )}
  </div>
);

export interface TextFieldProps
  extends FieldProps, Omit<ComponentProps<"input">, "className" | "style"> {}

/** A labelled single-line text input in an inset cell. */
export const TextField = ({
  description,
  error,
  id: given,
  label,
  style,
  ...props
}: TextFieldProps) => {
  const { hint, id } = useField({ description, error, label }, given);
  return (
    <Frame {...{ description, error, hint, id, label, style }}>
      <input
        id={id}
        aria-describedby={hint}
        aria-invalid={error ? true : undefined}
        {...props}
        {...stylex.props(styles.control, Boolean(error) && styles.invalid)}
      />
    </Frame>
  );
};

export interface TextAreaProps
  extends FieldProps, Omit<ComponentProps<"textarea">, "className" | "style"> {}

/**
 * A labelled multi-line input for long text. Uses relaxed spacing, which
 * helps when reviewing a long passage.
 */
export const TextArea = ({
  description,
  error,
  id: given,
  label,
  style,
  ...props
}: TextAreaProps) => {
  const { hint, id } = useField({ description, error, label }, given);
  return (
    <Frame {...{ description, error, hint, id, label, style }}>
      <textarea
        id={id}
        aria-describedby={hint}
        aria-invalid={error ? true : undefined}
        {...props}
        {...stylex.props(
          styles.control,
          styles.multiline,
          Boolean(error) && styles.invalid
        )}
      />
    </Frame>
  );
};
