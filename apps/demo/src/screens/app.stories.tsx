import { collapse, open, stop } from "@dyslexia/web/lib/now-playing";
import { recordingOf } from "@dyslexia/web/lib/recording";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { DemoApp } from "../demo-app";
import { bookshelf, making, ready } from "../fixtures";

const meta = {
  args: { narrations: bookshelf, path: "/" },
  beforeEach: () => {
    stop();
  },
  component: DemoApp,
  globals: { viewport: { isRotated: false, value: "iphone" } },
  parameters: { screen: true },
  title: "App",
} satisfies Meta<typeof DemoApp>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Shows the mini player, as after listening for a while. */
const listening = () => {
  const narration = bookshelf.find(
    (item): item is Extract<typeof item, { state: "ready" }> =>
      item.state === "ready"
  );
  if (narration) {
    open(recordingOf(narration));
    collapse();
  }
};

/** Home, with what to pick up and what is new. Every tab and button works. */
export const Home: Story = {};

/** Home with the mini player above the tab bar. */
export const HomeListening: Story = { beforeEach: listening };

/** The whole library, long enough to scroll under the title and filters. */
export const Library: Story = { args: { path: "/library" } };

export const LibraryListening: Story = {
  args: { path: "/library" },
  beforeEach: listening,
};

export const Profile: Story = { args: { path: "/profile" } };

/** A new listener, whose first narrations are still being made. */
export const FirstNarrations: Story = {
  args: {
    narrations: [
      making({ id: "a", stage: "recording", title: "Why we sleep" }),
      ready({ id: "b" }),
    ],
  },
};
