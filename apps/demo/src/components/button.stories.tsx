import { Button, IconButton, PlayIcon, PlusIcon } from "@dyslexia/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { fn } from "storybook/test";

const styles = stylex.create({
  row: { alignItems: "center", display: "flex", gap: "1rem" },
});

const meta = {
  args: { children: "Create draft", onClick: fn() },
  component: Button,
  title: "Components/Button",
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {};
export const Tinted: Story = { args: { variant: "tinted" } };
export const Gray: Story = { args: { variant: "gray" } };
export const Plain: Story = { args: { variant: "plain" } };
export const Destructive: Story = {
  args: { children: "Sign out", variant: "destructive" },
};
export const Large: Story = {
  args: { block: true, children: "Sign in with Google", size: "large" },
};
export const WithIcon: Story = {
  args: { children: "Add article", icon: <PlusIcon /> },
};
export const Loading: Story = {
  args: { children: "Starting…", loading: true, size: "large" },
};
export const Disabled: Story = { args: { disabled: true } };

/** Round buttons that show only an icon. Each needs a label. */
export const IconButtons: Story = {
  render: () => (
    <div {...stylex.props(styles.row)}>
      <IconButton label="Add article" icon={<PlusIcon />} />
      <IconButton label="Add article" icon={<PlusIcon />} variant="gray" />
      <IconButton label="Add article" icon={<PlusIcon />} variant="plain" />
      <IconButton
        label="play"
        icon={<PlayIcon />}
        variant="filled"
        size="large"
      />
    </div>
  ),
};
