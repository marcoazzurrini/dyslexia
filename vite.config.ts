import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({
      // Browser tests mock paid APIs. Test real FFmpeg separately, without
      // exposing the host Docker daemon inside the verification container.
      config: (config) => ({
        dev: { ...config.dev, enable_containers: process.env.CI !== "true" },
      }),
      viteEnvironment: { name: "ssr" },
    }),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: { outputPath: "/index.html" },
      },
    }),
    react(),
  ],
  // Use the same loopback address for SPA prerendering in Linux containers.
  preview: { host: "127.0.0.1" },
});
