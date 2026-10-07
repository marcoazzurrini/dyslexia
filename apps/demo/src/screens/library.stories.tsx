import { LibraryScreen } from "@dyslexia/web/screens/library-screen";
import { NewNarrationSheet } from "@dyslexia/web/screens/new-narration-sheet";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { library } from "../fixtures";
import { withRouter } from "../with-router";

const meta = {
  args: {
    jobs: library,
    onAccount: fn(),
    onAdd: fn(),
    onPlay: fn(),
    onRetry: fn(),
  },
  component: LibraryScreen,
  decorators: [withRouter],
  parameters: { screen: true },
  title: "Screens/Library",
} satisfies Meta<typeof LibraryScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryState: Story = {};
export const Loading: Story = { args: { jobs: null } };
export const Empty: Story = { args: { jobs: [] } };
export const LoadFailed: Story = {
  args: {
    error: "The narration service could not complete this request.",
    jobs: null,
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
        error="Extraction failed: the page did not respond."
        onClose={fn()}
        onSubmit={fn()}
      />
    </>
  ),
};
