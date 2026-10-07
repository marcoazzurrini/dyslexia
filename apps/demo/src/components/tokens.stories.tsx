import { Text } from "@dyslexia/ui";
import type { TextVariant } from "@dyslexia/ui";
import { color, radius } from "@dyslexia/ui/tokens.stylex";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  chip: {
    borderColor: color.separator,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: "1px",
    height: "4rem",
  },
  color: (value: string) => ({ backgroundColor: value }),
  grid: {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))",
  },
  stack: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  swatch: { display: "flex", flexDirection: "column", gap: "0.5rem" },
});

const meta = {
  args: { children: "Reading is a recent invention." },
  component: Text,
  title: "Foundations",
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS: TextVariant[] = [
  "largeTitle",
  "title1",
  "title2",
  "title3",
  "headline",
  "body",
  "callout",
  "subheadline",
  "footnote",
  "caption",
];

/** iOS text styles. On iPhone they follow the system text size setting. */
export const Typography: Story = {
  render: () => (
    <div {...stylex.props(styles.stack)}>
      {VARIANTS.map((variant) => (
        <Text key={variant} variant={variant}>
          {variant}: Reading is a recent invention.
        </Text>
      ))}
    </div>
  ),
};

const COLORS = [
  "accent",
  "accentText",
  "accentFill",
  "background",
  "surface",
  "label",
  "secondaryLabel",
  "tertiaryLabel",
  "separator",
  "fill",
  "danger",
  "warning",
] as const;

/** Semantic colors. Switch the system appearance to see the dark values. */
export const Colors: Story = {
  render: () => (
    <div {...stylex.props(styles.grid)}>
      {COLORS.map((name) => (
        <div key={name} {...stylex.props(styles.swatch)}>
          <div {...stylex.props(styles.chip, styles.color(color[name]))} />
          <Text variant="footnote">{name}</Text>
        </div>
      ))}
    </div>
  ),
};
