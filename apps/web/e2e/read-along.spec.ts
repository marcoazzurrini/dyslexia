import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { makeNarration, mockNarrations, readAudio, rowOf } from "./fixtures";

const audioValue = async (
  page: Page,
  key: "duration" | "paused" | "position"
) => {
  const state = await readAudio(page);
  return state[key];
};

const player = (page: Page) =>
  page.getByRole("dialog", { name: "Now playing" });

const text = (page: Page) =>
  page.getByRole("dialog", { name: "A new article" });

const openWithText = async (page: Page, transcript = true) => {
  const state = await mockNarrations(page, {
    narrations: [makeNarration("ready", { transcript })],
  });
  await page.goto("/library");
  await rowOf(page, "A new article").click();
  await expect.poll(() => audioValue(page, "duration")).toBe(60);
  return state;
};

test("the player shows a glimpse of the text, and the whole text over it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openWithText(page);
  const card = player(page).getByRole("region", { name: "Read along" });
  await expect(card).toContainText("The first paragraph starts here.");
  await card.getByRole("button", { name: "Show text" }).click();
  await expect(text(page)).toBeVisible();
  await expect(text(page).getByText("const answer = 42;")).toBeVisible();
  await expect(text(page).getByText("Code, not read aloud")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the text follows the voice, and plays from a tapped paragraph", async ({
  page,
}) => {
  await openWithText(page);
  await player(page).getByRole("button", { name: "Show text" }).click();
  await text(page)
    .getByRole("button", { name: "The second paragraph follows." })
    .click();
  await expect
    .poll(() => audioValue(page, "position"))
    .toBeGreaterThanOrEqual(20);
  expect(await audioValue(page, "paused")).toBe(false);
  const second = text(page).getByRole("button", {
    name: "The second paragraph follows.",
  });
  await expect(second).toHaveAttribute("aria-current", "true");
  await expect(second.locator("mark")).toHaveText(/The|second/u);
  // Closing the text goes back to the player.
  await text(page).getByRole("button", { name: "Close" }).click();
  await expect(text(page)).toBeHidden();
  await expect(player(page)).toBeVisible();
});

test("a narration made before transcripts shows no text", async ({ page }) => {
  await openWithText(page, false);
  await expect(
    player(page).getByRole("region", { name: "Read along" })
  ).toHaveCount(0);
});
