import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const svg = await readFile(
  new URL("../public/icon.svg", import.meta.url),
  "utf-8"
);
const directory = new URL("../public/icons/", import.meta.url);
await mkdir(directory, { recursive: true });

const browser = await chromium.launch();

try {
  await Promise.all(
    [
      ["icon-192.png", 192],
      ["icon-512.png", 512],
      ["icon-maskable-512.png", 512],
      ["apple-touch-icon.png", 180],
    ].map(async ([filename, size]) => {
      const page = await browser.newPage({
        viewport: { height: size, width: size },
      });

      try {
        await page.setContent(`
          <!doctype html>
          <html lang="en">
            <head>
              <style>
                body { margin: 0; }
                svg { display: block; width: 100vw; height: 100vh; }
              </style>
            </head>
            <body>${svg}</body>
          </html>
        `);
        await page.screenshot({
          path: fileURLToPath(new URL(filename, directory)),
        });
        console.log(`Generated ${filename} (${size}x${size})`);
      } finally {
        await page.close();
      }
    })
  );
} finally {
  await browser.close();
}
