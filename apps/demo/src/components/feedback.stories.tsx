import {
  ActivityIndicator,
  Button,
  EmptyState,
  Notice,
  ProgressBar,
  StepList,
  WaveformIcon,
} from "@dyslexia/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  args: { title: "Review the extracted article" },
  component: Notice,
  title: "Components/Feedback",
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: { children: "Only the text left below is adapted." },
};
export const Warning: Story = {
  args: { title: "Narration setup needed", tone: "warning" },
};
export const Danger: Story = {
  args: {
    action: <Button variant="tinted">Try again</Button>,
    children: "The narration service could not complete this request.",
    title: "Could not load narrations",
    tone: "danger",
  },
};

export const Steps: Story = {
  render: () => (
    <StepList
      label="Narration progress"
      steps={[
        { label: "Extract source", state: "done" },
        { label: "Review source", state: "done" },
        { label: "Adapt text", state: "current" },
        { label: "Review narration", state: "upcoming" },
        { label: "Generate speech", state: "failed" },
      ]}
    />
  ),
};

export const Progress: Story = {
  render: () => (
    <>
      <ActivityIndicator size="large" label="Loading" />
      <ProgressBar label="Speech segments" value={3} max={8} />
    </>
  ),
};

export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={<WaveformIcon />}
      title="No narrations yet"
      description="Add an article link to make your first narration."
      action={<Button>Add article</Button>}
    />
  ),
};
