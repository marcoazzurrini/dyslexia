import { ProfileScreen } from "@dyslexia/web/screens/profile-screen";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const meta = {
  args: {
    account: { email: "reader@example.com", name: "Ada Reader" },
    busy: false,
    onSignOut: fn(),
  },
  component: ProfileScreen,
  parameters: { screen: true },
  title: "Screens/Profile",
} satisfies Meta<typeof ProfileScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {};
export const Loading: Story = { args: { account: null } };
export const SigningOut: Story = { args: { busy: true } };
export const LoadFailed: Story = {
  args: {
    account: null,
    error: "Check your connection, then open Profile again.",
  },
};
