import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { makeNarration, mockNarrations, openPlayer } from "./fixtures";

/**
 * Drags a row left by `distance` pixels, as a finger would. A slow drag
 * rests before lifting, so it carries no speed.
 */
const swipeLeft = async (
  page: Page,
  row: Locator,
  distance: number,
  { slow = false } = {}
) => {
  const box = await row.boundingBox();
  if (!box) {
    throw new Error("The row is not visible");
  }
  const y = box.y + box.height / 2;
  const startX = box.x + box.width * 0.6;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - distance, y, { steps: 12 });
  if (slow) {
    await page.waitForTimeout(150);
  }
  await page.mouse.up();
};

const deleteAction = (page: Page) => page.getByText("Delete", { exact: true });

/** Where a row rests, before any swipe. */
const restingX = async (row: Locator) => {
  const box = await row.boundingBox();
  return box?.x;
};

/** How far the row has slid from where it rests. */
const offset = async (row: Locator, rest: number | undefined) => {
  const box = await row.boundingBox();
  return Math.round((box?.x ?? 0) - (rest ?? 0));
};

test("swiping a narration left reveals Delete, which deletes it", async ({
  page,
}) => {
  const state = await mockNarrations(page, {
    narrations: [makeNarration("ready")],
  });
  await page.goto("/library");
  const row = page.getByRole("button", { name: "Play A new article" });
  const rest = await restingX(row);
  await swipeLeft(page, row, 140);
  // The row settles open, showing the 88-pixel Delete button.
  await expect.poll(() => offset(row, rest)).toBe(-88);
  await deleteAction(page).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText("No narrations yet")).toBeVisible();
  expect(state.mutations).toEqual([
    { body: null, method: "DELETE", path: "/job-one" },
  ]);
  await expect(page.locator("audio")).toHaveCount(0);
});

test("a short swipe springs back, and nothing is deleted", async ({ page }) => {
  const state = await mockNarrations(page, {
    narrations: [makeNarration("ready")],
  });
  await page.goto("/library");
  const row = page.getByRole("button", { name: "Play A new article" });
  const rest = await restingX(row);
  await swipeLeft(page, row, 25, { slow: true });
  await expect.poll(() => offset(row, rest)).toBe(0);
  expect(state.mutations).toEqual([]);
});

test("swiping another row closes the open one", async ({ page }) => {
  await mockNarrations(page, {
    narrations: [
      makeNarration("ready"),
      makeNarration("ready", { id: "job-two", title: "Second" }),
    ],
  });
  await page.goto("/library");
  const first = page.getByRole("button", { name: "Play A new article" });
  const second = page.getByRole("button", { name: "Play Second" });
  const rest = await restingX(first);
  await swipeLeft(page, first, 140);
  await expect.poll(() => offset(first, rest)).toBe(-88);
  await swipeLeft(page, second, 140);
  await expect.poll(() => offset(second, rest)).toBe(-88);
  await expect.poll(() => offset(first, rest)).toBe(0);
});

test("tapping an open row closes it instead of playing", async ({ page }) => {
  await mockNarrations(page, { narrations: [makeNarration("ready")] });
  await page.goto("/library");
  const row = page.getByRole("button", { name: "Play A new article" });
  const rest = await restingX(row);
  await swipeLeft(page, row, 140);
  await expect.poll(() => offset(row, rest)).toBe(-88);
  // Tap the part of the row still on screen.
  await row.click();
  await expect.poll(() => offset(row, rest)).toBe(0);
  await expect(page.getByRole("dialog", { name: "Now playing" })).toHaveCount(
    0
  );
  // The next tap plays as usual.
  await row.click();
  await expect(page.getByRole("dialog", { name: "Now playing" })).toBeVisible();
});

test("the options button deletes a narration without a gesture", async ({
  page,
}) => {
  const state = await mockNarrations(page, {
    narrations: [
      makeNarration("ready"),
      makeNarration("ready", { id: "job-two", title: "Kept" }),
    ],
  });
  await page.goto("/library");
  await page.getByRole("button", { name: "Options for A new article" }).click();
  const sheet = page.getByRole("dialog", { name: "A new article" });
  await sheet.getByRole("button", { name: "Delete narration" }).click();
  await expect(sheet).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Play A new article" })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play Kept" })).toBeVisible();
  expect(state.mutations).toEqual([
    { body: null, method: "DELETE", path: "/job-one" },
  ]);
});

test("deleting the narration that is playing stops the player", async ({
  page,
}) => {
  await openPlayer(page);
  const player = page.getByRole("dialog", { name: "Now playing" });
  await player.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("audio")).toHaveCount(1);
  await page.getByRole("button", { name: "Options for A new article" }).click();
  await page.getByRole("button", { name: "Delete narration" }).click();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("a failed narration can be swiped away too", async ({ page }) => {
  const state = await mockNarrations(page, {
    narrations: [makeNarration("failed", { title: "Paywalled article" })],
  });
  await page.goto("/library");
  const row = page.getByRole("button", { name: /Paywalled article/u });
  const rest = await restingX(row);
  await swipeLeft(page, row, 140);
  await expect.poll(() => offset(row, rest)).toBe(-88);
  await deleteAction(page).click();
  await expect(page.getByText("No narrations yet")).toBeVisible();
  expect(state.mutations).toEqual([
    { body: null, method: "DELETE", path: "/job-one" },
  ]);
});

test("a refused deletion brings the narration back and says why", async ({
  page,
}) => {
  await mockNarrations(page, { narrations: [makeNarration("ready")] });
  await page.route("**/api/narrations/job-one", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({ json: { _tag: "NotConfigured" }, status: 503 })
      : route.fallback()
  );
  await page.goto("/library");
  await page.getByRole("button", { name: "Options for A new article" }).click();
  await page.getByRole("button", { name: "Delete narration" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not delete the narration"
  );
  await expect(
    page.getByRole("button", { name: "Play A new article" })
  ).toBeVisible();
});
