import type { Route } from "@playwright/test";
import { expect, test } from "@playwright/test";

import {
  makeNarration,
  mockNarrations,
  readAudio,
  setVisibility,
} from "./fixtures";

test("Google sign-in returns to the app, and sign-out signs out", async ({
  page,
}) => {
  const state = await mockNarrations(page, { authenticated: false });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^Good (?:morning|afternoon|evening)$/u,
    })
  ).toBeVisible();
  expect(state.authRequests).toEqual([
    {
      body: { callbackURL: "/", errorCallbackURL: "/", provider: "google" },
      path: "/sign-in/social",
    },
  ]);
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByText("reader@example.com")).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
  expect(state.authRequests.at(-1)?.path).toBe("/sign-out");
});

test("a rejected Google account is explained", async ({ page }) => {
  await mockNarrations(page, { authenticated: false });
  await page.goto("/?error=account_not_allowed");
  await expect(page.getByRole("alert")).toContainText(
    "That Google account cannot use this app"
  );
});

test("unconfigured service explains setup without offering sign-in", async ({
  page,
}) => {
  const state = await mockNarrations(page, {
    authenticated: false,
    configured: false,
  });
  await page.goto("/library");
  await expect(page.getByText("Narration setup needed")).toBeVisible();
  await expect(page.getByText(/configure Google sign-in/u)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toHaveCount(0);
  expect(state.listRequests).toBe(0);
});

test("adds an article link and shows it being made", async ({ page }) => {
  const state = await mockNarrations(page);
  await page.goto("/library");
  await expect(page.getByText("No narrations yet")).toBeVisible();
  await page.getByRole("button", { name: "Add article" }).first().click();
  const link = page.getByLabel("Article link", { exact: true });
  await link.fill("http://example.com/article");
  const submit = page.getByRole("button", {
    exact: true,
    name: "Make narration",
  });
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("HTTPS");
  expect(state.mutations).toHaveLength(0);
  await link.fill("https://example.com/article");
  await submit.click();
  await expect(page.getByRole("dialog", { name: "Add article" })).toBeHidden();
  const making = page.getByRole("list").filter({ hasText: "A new article" });
  await expect(making).toContainText("Reading the article…");
  expect(state.mutations).toEqual([
    { body: { url: "https://example.com/article" }, method: "POST", path: "" },
  ]);
});

test("a narration being made shows its progress and becomes playable", async ({
  page,
}) => {
  await page.clock.install();
  const state = await mockNarrations(page, {
    narrations: [
      {
        createdAt: "2026-01-01T00:00:00Z",
        id: "job-one",
        progress: { done: 3, total: 8 },
        stage: "recording",
        state: "making",
        title: "A new article",
        url: "https://example.com/article",
      },
    ],
  });
  await page.goto("/library");
  await expect(page.getByText("Recording 3 of 8…")).toBeVisible();
  state.narrations.set("job-one", makeNarration("ready"));
  await page.clock.fastForward(3000);
  await expect(
    page.getByRole("button", { name: "Play A new article" })
  ).toBeVisible();
  await expect(page.getByText("Being made")).toHaveCount(0);
  // Nothing is being made, so the library stops asking.
  const settled = state.listRequests;
  await page.clock.fastForward(12_000);
  expect(state.listRequests).toBe(settled);
});

test("polls only while the page is visible", async ({ page }) => {
  await page.clock.install();
  const state = await mockNarrations(page, {
    narrations: [makeNarration("making")],
  });
  await page.goto("/library");
  await expect(page.getByText("Reading the article…")).toBeVisible();
  const before = state.listRequests;
  await page.clock.fastForward(3000);
  await expect.poll(() => state.listRequests).toBeGreaterThan(before);
  await setVisibility(page, "hidden");
  const hidden = state.listRequests;
  await page.clock.fastForward(12_000);
  expect(state.listRequests).toBe(hidden);
  state.narrations.set("job-one", makeNarration("ready"));
  await setVisibility(page, "visible");
  await expect(
    page.getByRole("button", { name: "Play A new article" })
  ).toBeVisible();
});

test("slow polling never overlaps and hidden pages abort in-flight reads", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).endsWith("/api/narrations")) {
        init?.signal?.addEventListener("abort", () => {
          document.documentElement.dataset.listAborted = "true";
        });
      }
      return original.call(window, input, init);
    };
  });
  await mockNarrations(page, { narrations: [makeNarration("making")] });
  await page.goto("/library");
  await expect(page.getByText("Reading the article…")).toBeVisible();
  const pending: Route[] = [];
  await page.route("**/api/narrations", (route) => {
    pending.push(route);
  });
  await page.clock.fastForward(3000);
  await expect.poll(() => pending.length).toBe(1);
  await page.clock.fastForward(12_000);
  expect(pending).toHaveLength(1);
  await setVisibility(page, "hidden");
  await expect(page.locator("html")).toHaveAttribute(
    "data-list-aborted",
    "true"
  );
  await page.clock.fastForward(12_000);
  expect(pending).toHaveLength(1);
  await Promise.all(pending.map((route) => route.abort()));
});

test("a failed narration explains why and can be made again", async ({
  page,
}) => {
  const state = await mockNarrations(page, {
    narrations: [makeNarration("failed", { title: "Paywalled article" })],
  });
  await page.goto("/library");
  await page.getByRole("button", { name: /Paywalled article/u }).click();
  const sheet = page.getByRole("dialog", { name: "Paywalled article" });
  await expect(sheet).toContainText("behind a paywall");
  await expect(sheet).toContainText("Nothing was kept from the attempt.");
  await sheet.getByRole("button", { exact: true, name: "Try again" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Reading the article…")).toBeVisible();
  expect(state.mutations).toEqual([
    { body: null, method: "POST", path: "/job-one/retry" },
  ]);
});

test("a failed narration can be removed", async ({ page }) => {
  const state = await mockNarrations(page, {
    narrations: [makeNarration("failed", { title: "Paywalled article" })],
  });
  await page.goto("/library");
  await page.getByRole("button", { name: /Paywalled article/u }).click();
  const sheet = page.getByRole("dialog", { name: "Paywalled article" });
  await sheet.getByRole("button", { exact: true, name: "Remove" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("No narrations yet")).toBeVisible();
  expect(state.mutations).toEqual([
    { body: null, method: "DELETE", path: "/job-one" },
  ]);
});

test("the failed narration sheet fits a narrow screen", async ({ page }) => {
  await page.setViewportSize({ height: 640, width: 320 });
  await mockNarrations(page, {
    narrations: [makeNarration("failed", { title: "A".repeat(80) })],
  });
  await page.goto("/library");
  await page.getByRole("button", { name: /AAAA/u }).click();
  const retry = page.getByRole("button", { exact: true, name: "Try again" });
  await expect(retry).toBeVisible();
  const box = await retry.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

test("session expiry clears private narrations and offers sign-in", async ({
  page,
}) => {
  await page.clock.install();
  const state = await mockNarrations(page, {
    narrations: [makeNarration("making")],
  });
  await page.goto("/library");
  await expect(page.getByText("Reading the article…")).toBeVisible();
  state.authenticated = false;
  await page.clock.fastForward(3000);
  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("signed out");
  await expect(page.getByText("A new article")).toHaveCount(0);
});

test("playback continues behind the library, and each recording keeps its own place", async ({
  page,
}) => {
  await mockNarrations(page, {
    narrations: [
      makeNarration("ready", { title: "First recording" }),
      makeNarration("ready", { id: "job-two", title: "Second recording" }),
      makeNarration("making", { id: "job-three", title: "Still working" }),
    ],
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "dyslexia:playback:job-one:job-one",
      JSON.stringify({ position: 8, rate: 1.25 })
    );
    localStorage.setItem(
      "dyslexia:playback:job-two:job-two",
      JSON.stringify({ position: 24, rate: 1.5 })
    );
  });
  await page.goto("/library");
  await page.getByRole("button", { name: "Play First recording" }).click();
  const player = page.getByRole("dialog", { name: "Now playing" });
  await expect(
    player.getByRole("heading", { name: "First recording" })
  ).toBeVisible();
  await expect(page.locator("audio")).toHaveAttribute(
    "src",
    "/api/narrations/job-one/audio"
  );
  await expect
    .poll(() => readAudio(page))
    .toMatchObject({ duration: 60, paused: true, position: 8, rate: 1.25 });
  const metadata = await page.evaluate(() =>
    navigator.mediaSession?.metadata
      ? {
          artist: navigator.mediaSession.metadata.artist,
          title: navigator.mediaSession.metadata.title,
        }
      : null
  );
  if (metadata) {
    expect(metadata).toEqual({
      artist: "example.com",
      title: "First recording",
    });
  }

  await player.getByRole("button", { exact: true, name: "play" }).click();
  const first = await page.locator("audio").elementHandle();
  await player.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("Still working")).toBeVisible();
  expect(
    await first?.evaluate((audio) => audio === document.querySelector("audio"))
  ).toBe(true);
  await expect.poll(() => readAudio(page)).toMatchObject({ paused: false });

  await page.getByRole("button", { name: "Play Second recording" }).click();
  await expect
    .poll(() => readAudio(page))
    .toMatchObject({ duration: 60, paused: true, position: 24, rate: 1.5 });
  await expect(page.locator("audio")).toHaveCount(1);
  const saved = (key: string) =>
    page.evaluate(
      (storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? "null"),
      key
    );
  // The first keeps the place it reached, never the second's.
  const firstPlace = await saved("dyslexia:playback:job-one:job-one");
  expect(firstPlace).toMatchObject({ rate: 1.25 });
  expect(firstPlace.position).toBeGreaterThanOrEqual(8);
  expect(firstPlace.position).toBeLessThan(24);
  // The second starts from its own place, untouched by the first.
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await saved("dyslexia:playback:job-two:job-two")).toMatchObject({
    position: 24,
    rate: 1.5,
  });
});
