import { Button, Sheet, Text } from "@dyslexia/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

const meta = {
  args: {
    children: null,
    onClose: fn(),
    open: false,
    title: "Account",
  },
  component: Sheet,
  title: "Components/Sheet",
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const Demo = () => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open sheet</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Account">
        <Text tone="secondary">
          Drag the sheet down, tap outside, or press Escape to close it.
        </Text>
        <Button variant="destructive" size="large" block>
          Sign out
        </Button>
      </Sheet>
    </>
  );
};

/** Drag down to dismiss; a flick closes it from anywhere. */
export const Default: Story = { render: () => <Demo /> };
