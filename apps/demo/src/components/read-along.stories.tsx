import { ReadAlong, ReadAlongCard } from "@dyslexia/ui";
import {
  decodeTranscript,
  readAlongItemsOf,
} from "@dyslexia/web/lib/transcript";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import transcript from "../../public/read-along/transcript.json";

// A short article written for these stories, narrated and timed by the real
// services: headings, paragraphs, a picture, code, and a table.
const items = readAlongItemsOf(decodeTranscript(transcript));

const meta = {
  args: { items, onSeek: fn(), position: { item: 1, word: 14 } },
  component: ReadAlong,
  globals: { viewport: { isRotated: false, value: "iphone" } },
  title: "Components/Read along",
} satisfies Meta<typeof ReadAlong>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The voice in the middle of a paragraph: the word it says is marked, and
 * what it already said steps back. Tap any item to play from there.
 */
export const FollowingTheVoice: Story = {};

/** The voice describing a picture, which shows as on the page. */
export const DescribingAPicture: Story = {
  args: { position: { item: 3, word: undefined } },
};

/** The voice reading code aloud. */
export const ReadingCode: Story = {
  args: { position: { item: 6, word: undefined } },
};

/** Before the voice starts, nothing is marked yet. */
export const BeforeTheVoice: Story = { args: { position: undefined } };

/** A glimpse of the text in the full player, with a way into the whole text. */
export const Card: Story = {
  render: ({ position }) => (
    <ReadAlongCard
      status="ready"
      items={items}
      position={position}
      onOpen={fn()}
      onRetry={fn()}
    />
  ),
};

export const CardLoading: Story = {
  render: () => (
    <ReadAlongCard
      status="loading"
      items={[]}
      position={undefined}
      onOpen={fn()}
      onRetry={fn()}
    />
  ),
};

/** The text could not load, as when offline; the listener can try again. */
export const CardFailed: Story = {
  render: () => (
    <ReadAlongCard
      status="failed"
      items={[]}
      position={undefined}
      onOpen={fn()}
      onRetry={fn()}
    />
  ),
};
