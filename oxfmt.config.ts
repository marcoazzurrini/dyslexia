import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "apps/web/src/routeTree.gen.ts",
    // Installed design skill and its working files, not project code.
    ".claude/skills/**",
    "**/.impeccable/**",
    "**/package-lock.json",
    "bun.lock",
  ],
});
