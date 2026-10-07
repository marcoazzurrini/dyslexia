import { SegmentedControl, Switch, TextArea, TextField } from "@dyslexia/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

const meta = {
  args: { label: "Article link" },
  component: TextField,
  title: "Components/Fields",
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: {
    description: "Use an HTTPS link.",
    placeholder: "https://example.com/article",
  },
};

export const Invalid: Story = {
  args: {
    defaultValue: "example.com",
    error: "Enter a valid HTTPS article link.",
  },
};

export const Multiline: Story = {
  render: () => (
    <TextArea
      label="Narration text"
      rows={8}
      defaultValue="Reading is a recent invention. Writing appeared about five thousand years ago."
    />
  ),
};

const SwitchDemo = () => {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      label="Approve speech generation"
      description="Up to the maximum above."
      checked={checked}
      onChange={setChecked}
    />
  );
};

export const Toggle: Story = { render: () => <SwitchDemo /> };

const SpeedDemo = () => {
  const [rate, setRate] = useState(1);
  return (
    <SegmentedControl
      label="Speed"
      options={[0.75, 1, 1.25, 1.5, 2].map((value) => ({
        label: `${value}×`,
        value,
      }))}
      value={rate}
      onChange={setRate}
    />
  );
};

export const Segmented: Story = { render: () => <SpeedDemo /> };
