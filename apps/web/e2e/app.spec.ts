import { expect, test } from "@playwright/test";

import { makeNarration, mockNarrations } from "./fixtures";

for (const authenticated of [false, true]) {
  test(`${authenticated ? "library" : "welcome"} loads without browser errors and fits the viewport`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await mockNarrations(page, {
      authenticated,
      narrations: [
        makeNarration("ready", {
          title: "A".repeat(120),
          url: `https://example.com/${"long-path".repeat(20)}`,
        }),
      ],
    });

    await page.goto("/");

    await expect(page).toHaveTitle("Dyslexia");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: authenticated ? "Library" : "Dyslexia",
      })
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("keyboard users can skip to the main content", async ({
  page,
  browserName,
}) => {
  await mockNarrations(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  // WebKit on macOS uses Option+Tab to include links in keyboard navigation.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("manifest and installation icons are valid and served as assets", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const manifestPath = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifestPath).toBe("/manifest.webmanifest");

  if (manifestPath === null) {
    throw new Error("Missing manifest link");
  }

  const response = await request.get(manifestPath);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("manifest+json");
  const manifest = await response.json();
  expect(manifest.name).toBe("Dyslexia");
  expect(manifest.display).toBe("standalone");
  expect(manifest.id).toBe("/");
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ purpose: "any", sizes: "192x192" }),
      expect.objectContaining({ purpose: "any", sizes: "512x512" }),
      expect.objectContaining({ purpose: "maskable", sizes: "512x512" }),
    ])
  );

  await Promise.all(
    manifest.icons.map(async (icon: { sizes: string; src: string }) => {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.ok()).toBe(true);
      expect(iconResponse.headers()["content-type"]).toContain("image/png");
      const bytes = await iconResponse.body();
      expect(bytes.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );
      const [width, height] = icon.sizes.split("x").map(Number);
      expect(bytes.readUInt32BE(16)).toBe(width);
      expect(bytes.readUInt32BE(20)).toBe(height);
    })
  );

  const appleIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect(appleIcon).toBe("/icons/apple-touch-icon.png");
  if (appleIcon === null) {
    throw new Error("Missing Apple touch icon link");
  }

  const appleResponse = await request.get(appleIcon);
  expect(appleResponse.ok()).toBe(true);
  const appleBytes = await appleResponse.body();
  expect(appleBytes.readUInt32BE(16)).toBe(180);
  expect(appleBytes.readUInt32BE(20)).toBe(180);
});

test("unknown navigation shows a not-found page and can return home", async ({
  page,
  baseURL,
}) => {
  await mockNarrations(page);
  await page.goto("/not-a-real-page");
  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Return home" }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
});

test("missing non-navigation assets return 404 rather than the app shell", async ({
  request,
}) => {
  const response = await request.get("/icons/does-not-exist.png");
  expect(response.status()).toBe(404);
});
