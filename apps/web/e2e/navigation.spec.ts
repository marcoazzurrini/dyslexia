import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { makeNarration, mockNarrations, rowOf } from "./fixtures";

/** Saves how far the listener got, as the player does. */
const seedListening = (
  page: Page,
  saved: Record<string, { position: number; playedAt: number }>
) =>
  page.addInitScript((entries) => {
    for (const [id, value] of Object.entries(entries)) {
      localStorage.setItem(
        `dyslexia:playback:${id}:${id}`,
        JSON.stringify({ ...value, rate: 1 })
      );
    }
  }, saved);

const tab = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });

const section = (page: Page, header: string) =>
  page.locator("section").filter({
    has: page.getByRole("heading", { exact: true, name: header }),
  });

/** Every narration is 10 minutes long. */
const narrations = [
  "Fresh",
  "Oldest listen",
  "Newest listen",
  "Middle listen",
  "Fourth listen",
  "Done",
].map((title, index) =>
  makeNarration("ready", { durationSeconds: 600, id: `n${index}`, title })
);

test("the tab bar moves between Home, Library, and Profile", async ({
  page,
}) => {
  await mockNarrations(page);
  await page.goto("/");
  await expect(tab(page, "Home")).toHaveAttribute("aria-current", "page");
  await tab(page, "Library").click();
  await expect(page).toHaveURL(/\/library$/u);
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(tab(page, "Library")).toHaveAttribute("aria-current", "page");
  await expect(tab(page, "Home")).not.toHaveAttribute("aria-current");
  await tab(page, "Profile").click();
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByText("Ada Reader")).toBeVisible();
  await tab(page, "Home").click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^Good /u })
  ).toBeVisible();
});

test("Home picks up the three latest listens and lists what is new", async ({
  page,
}) => {
  await seedListening(page, {
    n1: { playedAt: 1, position: 60 },
    n2: { playedAt: 4, position: 120 },
    n3: { playedAt: 3, position: 300 },
    n4: { playedAt: 2, position: 30 },
    n5: { playedAt: 5, position: 600 },
  });
  await mockNarrations(page, { narrations });
  await page.goto("/");
  const resume = section(page, "Pick up where you left off");
  await expect(resume.getByRole("button")).toHaveText([
    /Newest listen.*8 min left/u,
    /Middle listen.*5 min left/u,
    /Fourth listen.*10 min left/u,
  ]);
  await expect(
    section(page, "Recently added").getByRole("listitem")
  ).toHaveText([/Fresh/u]);
  // Finished narrations stay in the library, off Home.
  await expect(page.getByText("Done")).toHaveCount(0);
});

test("listening moves a narration to Pick up where you left off", async ({
  page,
}) => {
  await mockNarrations(page, { narrations: [narrations[0]] });
  await page.goto("/");
  await rowOf(page, "Fresh").click();
  const player = page.getByRole("dialog", { name: "Now playing" });
  await player.getByRole("button", { name: "seek forward 15 seconds" }).click();
  await player.getByRole("button", { name: "Close" }).click();
  await expect(
    section(page, "Pick up where you left off").getByRole("button", {
      name: "Fresh",
    })
  ).toBeVisible();
  await expect(page.getByText("Recently added")).toHaveCount(0);
});

test("the library filters by how far you got, and keeps the filter", async ({
  page,
}) => {
  await seedListening(page, {
    n1: { playedAt: 1, position: 60 },
    n5: { playedAt: 2, position: 600 },
  });
  await mockNarrations(page, {
    narrations: [
      makeNarration("making", { id: "m", title: "Being read" }),
      narrations[0],
      narrations[1],
      narrations[5],
    ],
  });
  await page.goto("/library");
  // Each narration ready to play is a row with its own Play button.
  const plays = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: /^Play /u }) });
  await expect(plays).toHaveCount(3);
  await expect(page.getByText("Being read")).toBeVisible();

  await page.getByRole("radio", { name: "Finished" }).check();
  await expect(page).toHaveURL(/\/library\?show=finished$/u);
  await expect(plays).toHaveText([/Done.*Finished/u]);
  await expect(page.getByText("Being read")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("radio", { name: "Finished" })).toBeChecked();
  await expect(plays).toHaveCount(1);

  await page.getByRole("radio", { name: "In progress" }).check();
  await expect(plays).toHaveText([/Oldest listen/u]);
  await page.getByRole("radio", { name: "Not started" }).check();
  await expect(plays).toHaveText([/Fresh/u]);
  await page.getByRole("radio", { name: "All" }).check();
  await expect(page).toHaveURL(/\/library$/u);
  await expect(plays).toHaveCount(3);
});

test("a narration can be marked finished, and unfinished again", async ({
  page,
}) => {
  await mockNarrations(page, { narrations: [narrations[0]] });
  await page.goto("/library");
  const play = page.getByRole("listitem").filter({ hasText: "Fresh" });
  await expect(play).toContainText("10 min");

  await page.getByRole("button", { name: "Options for Fresh" }).click();
  await page.getByRole("button", { name: "Mark as finished" }).click();
  await expect(page.getByRole("dialog", { name: "Fresh" })).toBeHidden();
  await expect(play).toContainText("Finished");
  await page.getByRole("radio", { name: "Finished" }).check();
  await expect(play).toBeVisible();

  await page.getByRole("button", { name: "Options for Fresh" }).click();
  await page.getByRole("button", { name: "Mark as unfinished" }).click();
  await expect(page.getByText("Nothing finished yet")).toBeVisible();
});

test("an empty filter says what would appear there", async ({ page }) => {
  await mockNarrations(page, { narrations: [narrations[0]] });
  await page.goto("/library?show=finished");
  await expect(page.getByText("Nothing finished yet")).toBeVisible();
});

test("Home offers to add an article when the library is empty", async ({
  page,
}) => {
  await mockNarrations(page);
  await page.goto("/");
  await expect(page.getByText("Nothing to listen to yet")).toBeVisible();
  await page.getByRole("button", { name: "Add article" }).last().click();
  await expect(page.getByRole("dialog", { name: "Add article" })).toBeVisible();
});
