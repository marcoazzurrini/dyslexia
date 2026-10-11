import { collapse, open, readAlong } from "@dyslexia/web/lib/now-playing";
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

/** A narration with its text, timed by the real services, to read along. */
const withText = {
  ...recording,
  duration: 123.873,
  id: "read-along",
  sourceUrl: "https://www.example.org/why-caches-feel-fast",
  src: "/read-along/audio.mp3",
  title: "Why caches make apps feel fast",
  transcriptUrl: "/read-along/transcript.json",
  version: "read-along",
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

/** The full player of a narration with text: a glimpse of it below the controls. */
export const NowPlayingWithText: Story = {
  beforeEach: () => {
    open(withText);
  },
};

/**
 * The whole text over the player. Press play: the text follows the voice
 * word by word. Scroll away and "Follow the voice" brings it back; tap a
 * paragraph to play from there.
 */
export const ReadingAlong: Story = {
  beforeEach: () => {
    open(withText);
    readAlong();
  },
};
