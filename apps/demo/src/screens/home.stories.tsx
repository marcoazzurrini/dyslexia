import { HomeScreen } from "@dyslexia/web/screens/home-screen";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { listened, listeningOf, ready } from "../fixtures";

const meta = {
  args: {
    listeningOf,
    narrations: listened,
    now: new Date("2026-10-09T19:30:00"),
    onAdd: fn(),
    onListen: fn(),
    onOpen: fn(),
    onOpenFailed: fn(),
    onPause: fn(),
    onReload: fn(),
  },
  component: HomeScreen,
  parameters: { screen: true },
  title: "Screens/Home",
} satisfies Meta<typeof HomeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryState: Story = {};
export const Morning: Story = {
  args: { now: new Date("2026-10-09T08:00:00") },
};
export const Loading: Story = { args: { narrations: null } };
export const Empty: Story = { args: { narrations: [] } };
/** Every narration has been listened to the end. */
export const CaughtUp: Story = {
  args: { narrations: [ready({ id: "h", title: "Before you memo()" })] },
};
export const LoadFailed: Story = {
  args: {
    error: "The narration service could not be reached. Try again.",
    narrations: null,
  },
};
