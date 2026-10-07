import { WelcomeScreen } from "@dyslexia/web/screens/welcome-screen";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const meta = {
  args: {
    busy: false,
    onRetry: fn(),
    onSignIn: fn(),
    session: { status: "signed-out" },
  },
  component: WelcomeScreen,
  parameters: { screen: true },
  title: "Screens/Welcome",
} satisfies Meta<typeof WelcomeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {};
export const OpeningGoogle: Story = { args: { busy: true } };
export const RejectedAccount: Story = {
  args: { signInError: "account_not_allowed" },
};
export const Checking: Story = { args: { session: { status: "checking" } } };
export const Unconfigured: Story = {
  args: { session: { status: "unconfigured" } },
};
export const Offline: Story = {
  args: {
    session: {
      message: "The narration service could not complete this request.",
      status: "error",
    },
  },
};
