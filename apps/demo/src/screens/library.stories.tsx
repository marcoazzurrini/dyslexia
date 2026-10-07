import { FailedSheet } from "@dyslexia/web/screens/failed-sheet";
import { LibraryScreen } from "@dyslexia/web/screens/library-screen";
import { NewNarrationSheet } from "@dyslexia/web/screens/new-narration-sheet";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { failed, library } from "../fixtures";
import { withRouter } from "../with-router";

const meta = {
  args: {
    narrations: library,
    onAccount: fn(),
    onAdd: fn(),
    onOpenFailed: fn(),
    onPlay: fn(),
    onReload: fn(),
  },
  component: LibraryScreen,
  decorators: [withRouter],
  parameters: { screen: true },
  title: "Screens/Library",
} satisfies Meta<typeof LibraryScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryState: Story = {};
export const Loading: Story = { args: { narrations: null } };
export const Empty: Story = { args: { narrations: [] } };
export const LoadFailed: Story = {
  args: {
    error: "The narration service could not be reached. Try again.",
    narrations: null,
  },
};

/** The sheet behind the add button. */
export const AddArticle: Story = {
  render: (args) => (
    <>
      <LibraryScreen {...args} />
      <NewNarrationSheet open busy={false} onClose={fn()} onSubmit={fn()} />
    </>
  ),
};

export const AddArticleRefused: Story = {
  render: (args) => (
    <>
      <LibraryScreen {...args} />
      <NewNarrationSheet
        open
        busy={false}
        error="Five narrations are already being made. Wait for one to finish."
        onClose={fn()}
        onSubmit={fn()}
      />
    </>
  ),
};

/** What a failed narration shows when tapped. */
export const FailedNarration: Story = {
  render: (args) => (
    <>
      <LibraryScreen {...args} />
      <FailedSheet
        narration={failed()}
        busy={null}
        onClose={fn()}
        onRemove={fn()}
        onRetry={fn()}
      />
    </>
  ),
};

export const FailedNarrationTooLong: Story = {
  render: (args) => (
    <>
      <LibraryScreen {...args} />
      <FailedSheet
        narration={failed({
          reason:
            "This article is too long to narrate: 143,200 characters, and the limit is 100,000.",
          title: "The complete history of everything",
        })}
        busy="retry"
        onClose={fn()}
        onRemove={fn()}
        onRetry={fn()}
      />
    </>
  ),
};
