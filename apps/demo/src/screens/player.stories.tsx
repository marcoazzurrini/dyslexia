import { collapse, open } from "@dyslexia/web/lib/now-playing";
import { Player } from "@dyslexia/web/player/player";
import type { Meta, StoryObj } from "@storybook/react-vite";

const recording = {
  artist: "example.org",
  duration: 1,
  id: "story",
  sourceUrl: "https://www.example.org/science/reading-brain",
  src: "/audio/a.mp3",
  title: "How the brain learns to read",
  version: "story",
};

const meta = {
  component: Player,
  parameters: { screen: true },
  title: "Screens/Player",
} satisfies Meta<typeof Player>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full player, over whatever screen is open. */
export const NowPlaying: Story = {
  beforeEach: () => {
    open(recording);
  },
};

/** The bar that keeps playback in reach on every screen. */
export const MiniPlayer: Story = {
  beforeEach: () => {
    open(recording);
    collapse();
  },
};
