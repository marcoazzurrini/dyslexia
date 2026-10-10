import {
  ChevronRightIcon,
  ListButton,
  ListLink,
  ListRow,
  ListSection,
  PlayIcon,
  WarningIcon,
} from "@dyslexia/ui";
import { Cover } from "@dyslexia/web/components/cover";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const meta = {
  args: { children: null },
  component: ListSection,
  title: "Components/List",
} satisfies Meta<typeof ListSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inset grouped rows, as in iOS Settings. */
export const Section: Story = {
  render: () => (
    <ListSection header="Ready to listen" footer="Tap a narration to play it.">
      <ListButton
        title="How the brain learns to read"
        subtitle="example.org · 13 min"
        accessory={<PlayIcon />}
        onClick={fn()}
      />
      <ListLink
        href="#"
        title="A field guide to clouds"
        subtitle="Generate speech"
      />
      <ListRow title="Version" detail="0.1.0" />
    </ListSection>
  ),
};

export const LongText: Story = {
  render: () => (
    <ListSection header="Stopped">
      <ListLink
        href="#"
        leading={<WarningIcon />}
        title="An article with a very long title that needs to wrap onto a second line on a phone"
        subtitle="Failed"
        accessory={<ChevronRightIcon />}
      />
    </ListSection>
  ),
};

/**
 * Swipe a row left to reveal Delete; tap the row or anywhere else to close
 * it. The more button offers the same action without a gesture.
 */
export const SwipeToDelete: Story = {
  render: () => (
    <ListSection header="Ready to listen">
      {["How the brain learns to read", "A field guide to clouds"].map(
        (title) => (
          <ListButton
            key={title}
            title={title}
            subtitle="example.org · 13 min"
            onClick={fn()}
            swipeAction={{ label: "Delete", onAction: fn() }}
            more={{ label: `Options for ${title}`, onClick: fn() }}
          />
        )
      )}
    </ListSection>
  ),
};

/**
 * Narrations on the canvas, as in Podcasts: one-line titles, the site, and
 * how far the listener got, with Play and more buttons.
 */
export const Media: Story = {
  render: () => (
    <ListSection header="Ready to listen" variant="media">
      <ListButton
        leading={<Cover url="https://example.org" size="row" />}
        title="How the brain learns to read, and why some of us find it hard"
        subtitle="example.org"
        meta={{ text: "13 min" }}
        onClick={fn()}
        action={{ icon: <PlayIcon />, label: "Play", onClick: fn() }}
        more={{ label: "Options", onClick: fn() }}
      />
      <ListButton
        leading={<Cover url="https://newyorker.com" size="row" />}
        title="The quiet history of the semicolon"
        subtitle="newyorker.com"
        meta={{ progress: 0.4, text: "8 min left" }}
        onClick={fn()}
        action={{ icon: <PlayIcon />, label: "Play", onClick: fn() }}
        more={{ label: "Options", onClick: fn() }}
      />
      <ListRow
        leading={<Cover url="https://example.org" size="row" tone="neutral" />}
        title="Why we sleep"
        subtitle="Reading the article…"
      />
    </ListSection>
  ),
};
