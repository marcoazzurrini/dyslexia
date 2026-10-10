import {
  Cover,
  coverTint,
  MediaCard,
  MediaTile,
  Section,
  Shelf,
} from "@dyslexia/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const meta = {
  args: {
    artwork: <Cover seed="pages.cs.wisc.edu" name="pages.cs.wisc" />,
    label: "Play Programming as theory building",
    meta: "pages.cs.wisc.edu · 18 min left",
    onClick: fn(),
    progress: 0.4,
    tint: coverTint("pages.cs.wisc.edu"),
    title: "Programming as theory building",
  },
  component: MediaCard,
  title: "Components/Media",
} satisfies Meta<typeof MediaCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Cards to pick up where the listener left off, on a shelf. */
export const Cards: Story = {
  render: (args) => (
    <Section title="Pick up where you left off">
      <Shelf>
        <MediaCard {...args} />
        <MediaCard
          {...args}
          artwork={<Cover seed="newyorker.com" name="newyorker" />}
          title="The quiet history of the semicolon"
          meta="newyorker.com · 8 min left"
          tint={coverTint("newyorker.com")}
          progress={0.7}
        />
      </Shelf>
    </Section>
  ),
};

/** The only card on its shelf spans the screen. */
export const WideCard: Story = { args: { wide: true } };

/** New narrations as tiles, on a shelf. */
export const Tiles: Story = {
  render: () => (
    <Section title="Recently added">
      <Shelf>
        {["example.org", "overreacted.io", "newyorker.com"].map((site) => (
          <MediaTile
            key={site}
            label={`Play an article from ${site}`}
            artwork={<Cover seed={site} name={site.split(".")[0] ?? site} />}
            title="A field guide to clouds, and how to read them"
            meta={`${site} · 13 min`}
            onClick={fn()}
          />
        ))}
      </Shelf>
    </Section>
  ),
};
