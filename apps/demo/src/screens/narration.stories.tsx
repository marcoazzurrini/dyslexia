import { NarrationScreen } from "@dyslexia/web/screens/narration-screen";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { detail } from "../fixtures";
import { withRouter } from "../with-router";

const meta = {
  args: {
    busy: false,
    detail: detail("extracting"),
    onApprove: fn(),
    onListen: fn(),
    onRetry: fn(),
    onSubmitSource: fn(),
  },
  component: NarrationScreen,
  decorators: [withRouter],
  parameters: { screen: true },
  title: "Screens/Narration",
} satisfies Meta<typeof NarrationScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Extracting: Story = {};
export const ReviewSource: Story = { args: { detail: detail("source_ready") } };
export const ReviewDraft: Story = { args: { detail: detail("draft_ready") } };
export const Submitting: Story = {
  args: { busy: true, detail: detail("draft_ready") },
};
export const Generating: Story = {
  args: { detail: detail("generating", { completedChunks: 3 }) },
};
export const Ready: Story = { args: { detail: detail("ready") } };
export const Failed: Story = {
  args: {
    detail: detail("failed", {
      error: "The article page could not be read (HTTP 403).",
    }),
  },
};
export const Uncertain: Story = { args: { detail: detail("uncertain") } };
export const Loading: Story = { args: { detail: null } };
export const RequestFailed: Story = {
  args: {
    detail: null,
    error: "The narration service could not complete this request.",
  },
};
