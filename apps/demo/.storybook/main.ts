import type { StorybookConfig } from "@storybook/react-vite";
import stylex from "@stylexjs/unplugin/vite";

const config: StorybookConfig = {
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  core: { disableTelemetry: true },
  framework: "@storybook/react-vite",
  // StyleX serves its CSS separately in development.
  previewHead: (head, { configType }) =>
    configType === "DEVELOPMENT"
      ? `${head}
<link rel="stylesheet" href="/virtual:stylex.css" />
<script type="module" src="/@id/virtual:stylex:runtime"></script>`
      : head,
  // A short MP3 for player stories, shared with the MP3 package tests.
  staticDirs: [{ from: "../../../packages/mp3/test/fixtures", to: "/audio" }],
  stories: ["../src/**/*.stories.tsx"],
  viteFinal: (vite) => ({
    ...vite,
    plugins: [...(vite.plugins ?? []), stylex()],
  }),
};

export default config;
