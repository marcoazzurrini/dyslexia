import "@dyslexia/ui/global.css";
import { color, font } from "@dyslexia/ui/tokens.stylex";
import type { Preview } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";

// The app follows the system appearance; switch it there to see dark mode.
const styles = stylex.create({
  canvas: {
    backgroundColor: color.background,
    color: color.label,
    fontFamily: font.family,
    minHeight: "100vh",
    padding: "1.25rem",
  },
  // Screens bring their own margins and safe areas.
  screen: { padding: 0 },
});

const preview: Preview = {
  decorators: [
    (Story, { parameters }) => (
      <div
        {...stylex.props(
          styles.canvas,
          parameters.screen === true && styles.screen
        )}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    a11y: { test: "error" },
    layout: "fullscreen",
    viewport: {
      options: {
        iphone: {
          name: "iPhone",
          styles: { height: "852px", width: "393px" },
          type: "mobile",
        },
      },
    },
  },
};

export default preview;
