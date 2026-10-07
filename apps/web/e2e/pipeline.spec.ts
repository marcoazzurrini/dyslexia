import type { Page, Route } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { makeDetail, mockPipeline, readAudio, setVisibility } from "./fixtures";

const currentStep = (page: Page) => page.locator('[aria-current="step"]');

test("Google sign-in returns to the app, and sign-out signs out", async ({
  page,
}) => {
  const state = await mockPipeline(page, { authenticated: false });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  expect(state.authRequests).toEqual([
    {
      body: { callbackURL: "/", errorCallbackURL: "/", provider: "google" },
      path: "/sign-in/social",
    },
  ]);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { exact: true, name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
  expect(state.authRequests.at(-1)?.path).toBe("/sign-out");
});

test("a rejected Google account is explained", async ({ page }) => {
  await mockPipeline(page, { authenticated: false });
  await page.goto("/?error=account_not_allowed");
  await expect(page.getByRole("alert")).toContainText(
    "That Google account cannot use this app"
  );
});

test("unconfigured service explains setup without offering sign-in", async ({
  page,
}) => {
  const state = await mockPipeline(page, {
    authenticated: false,
    configured: false,
  });
  await page.goto("/");
  await expect(page.getByText("Narration setup needed")).toBeVisible();
  await expect(page.getByText(/configure Google sign-in/u)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toHaveCount(0);
  expect(state.jobsRequests).toBe(0);
});

test("submits an HTTPS link and opens the new narration", async ({ page }) => {
  const state = await mockPipeline(page);
  await page.goto("/");
  await expect(page.getByText("No narrations yet")).toBeVisible();
  await page.getByRole("button", { name: "Add article" }).first().click();
  const link = page.getByLabel("Article link", { exact: true });
  await link.fill("http://example.com/article");
  await page.getByRole("button", { exact: true, name: "Create draft" }).click();
  await expect(page.getByRole("alert")).toContainText("HTTPS");
  expect(state.mutations).toHaveLength(0);
  await link.fill("https://example.com/article");
  await page.getByRole("button", { exact: true, name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/narrations\/job-one$/u);
  await expect(currentStep(page)).toContainText("Extract source");
  expect(state.mutations).toEqual([
    {
      body: { url: "https://example.com/article" },
      method: "POST",
      path: "/jobs",
    },
  ]);
});

test("the extracted source is editable and only submitted deliberately", async ({
  page,
}) => {
  const state = await mockPipeline(page, {
    details: [makeDetail("source_ready")],
  });
  await page.goto("/");
  await page.getByRole("link", { name: /A new article/u }).click();
  const text = page.getByLabel("Article text", { exact: true });
  await expect(text).toContainText("Delete this navigation.");
  await page
    .getByLabel("Article title", { exact: true })
    .fill("Selected article");
  await text.fill("# Selected article\n\nKeep this paragraph.");
  expect(state.mutations).toHaveLength(0);
  await page.getByRole("button", { name: "Adapt this text" }).click();
  await expect(currentStep(page)).toContainText("Adapt text");
  await expect(text).toHaveCount(0);
  expect(state.mutations).toEqual([
    {
      body: {
        markdown: "# Selected article\n\nKeep this paragraph.",
        title: "Selected article",
      },
      method: "POST",
      path: "/jobs/job-one/source",
    },
  ]);
});

test("draft review shows the cost and needs explicit approval", async ({
  page,
}) => {
  const state = await mockPipeline(page, {
    details: [makeDetail("draft_ready")],
  });
  await page.goto("/narrations/job-one");
  await expect(page.getByText("$0.42", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Extraction and adaptation are billed separately/u)
  ).toBeVisible();
  const maximum = page.getByLabel("Maximum speech cost (USD)", {
    exact: true,
  });
  await expect(maximum).toHaveValue("10");
  const generate = page.getByRole("button", { name: "Generate audio" });
  await expect(generate).toBeDisabled();
  await page
    .getByLabel("Narration title", { exact: true })
    .fill("My edited narration");
  await page
    .getByLabel("Narration text", { exact: true })
    .fill("Edited narration.");
  await maximum.fill("0.01");
  await expect(page.getByRole("alert")).toContainText(
    "covers the estimated speech cost"
  );
  await maximum.fill("2");
  const approval = page.getByRole("switch", {
    name: /Approve speech generation/u,
  });
  await approval.check();
  await page
    .getByLabel("Narration text", { exact: true })
    .fill("Final edited narration.");
  // Any edit withdraws the approval.
  await expect(approval).not.toBeChecked();
  await expect(generate).toBeDisabled();
  expect(state.mutations).toHaveLength(0);
  await approval.check();
  await generate.click();
  await expect(currentStep(page)).toContainText("Generate speech");
  expect(state.mutations).toEqual([
    {
      body: {
        maxCostUsd: 2,
        text: "Final edited narration.",
        title: "My edited narration",
      },
      method: "POST",
      path: "/jobs/job-one/approve",
    },
  ]);
});

for (const status of ["failed", "uncertain"] as const) {
  test(`${status} narration explains the outcome and never retries automatically`, async ({
    page,
  }) => {
    await page.clock.install();
    const state = await mockPipeline(page, {
      details: [
        makeDetail(status, { error: "Provider outcome requires review." }),
      ],
    });
    await page.goto("/narrations/job-one");
    await expect(
      page.getByText("Nothing will be retried automatically", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByText("Provider outcome requires review.")
    ).toBeVisible();
    if (status === "uncertain") {
      await expect(page.getByText(/generated or billed/u)).toBeVisible();
    }
    const requests = state.detailRequests;
    await page.clock.fastForward(12_000);
    expect(state.detailRequests).toBe(requests);
    expect(state.mutations).toHaveLength(0);
    await expect(
      page.getByRole("button", { name: "Generate audio" })
    ).toHaveCount(0);
  });
}

test("polls active narrations only while visible and stops after leaving", async ({
  page,
}) => {
  await page.clock.install();
  const state = await mockPipeline(page, {
    details: [makeDetail("extracting")],
  });
  await page.goto("/narrations/job-one");
  await expect(currentStep(page)).toContainText("Extract source");
  const before = state.detailRequests;
  await page.clock.fastForward(3000);
  await expect.poll(() => state.detailRequests).toBeGreaterThan(before);
  await setVisibility(page, "hidden");
  const hidden = state.detailRequests;
  await page.clock.fastForward(12_000);
  expect(state.detailRequests).toBe(hidden);
  state.details.set("job-one", makeDetail("source_ready"));
  await setVisibility(page, "visible");
  await expect(page.getByLabel("Article text", { exact: true })).toBeVisible();
  const idle = state.detailRequests;
  await page.clock.fastForward(12_000);
  expect(state.detailRequests).toBe(idle);
  state.details.set("job-one", makeDetail("adapting"));
  await page.getByRole("link", { name: "Library" }).click();
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  const left = state.detailRequests;
  await page.clock.fastForward(12_000);
  expect(state.detailRequests).toBe(left);
});

test("slow polling never overlaps and hidden pages abort in-flight reads", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).endsWith("/api/pipeline/jobs")) {
        init?.signal?.addEventListener("abort", () => {
          document.documentElement.dataset.jobsAborted = "true";
        });
      }
      return original.call(window, input, init);
    };
  });
  await mockPipeline(page, { details: [makeDetail("extracting")] });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /A new article/u })
  ).toBeVisible();
  const pending: Route[] = [];
  await page.route("**/api/pipeline/jobs", (route) => {
    pending.push(route);
  });
  await page.clock.fastForward(3000);
  await expect.poll(() => pending.length).toBe(1);
  await page.clock.fastForward(12_000);
  expect(pending).toHaveLength(1);
  await setVisibility(page, "hidden");
  await expect(page.locator("html")).toHaveAttribute(
    "data-jobs-aborted",
    "true"
  );
  await page.clock.fastForward(12_000);
  expect(pending).toHaveLength(1);
  await Promise.all(pending.map((route) => route.abort()));
});

test("session expiry clears private narrations and offers sign-in", async ({
  page,
}) => {
  await page.clock.install();
  const state = await mockPipeline(page, {
    details: [makeDetail("extracting")],
  });
  await page.goto("/narrations/job-one");
  await expect(currentStep(page)).toContainText("Extract source");
  state.authenticated = false;
  await page.clock.fastForward(3000);
  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("signed out");
  await expect(page.getByText("A new article")).toHaveCount(0);
});

test("playback survives navigation, and each recording keeps its own place", async ({
  page,
}) => {
  await mockPipeline(page, {
    details: [
      makeDetail("ready", { title: "First recording" }),
      makeDetail("ready", { id: "job-two", title: "Second recording" }),
      makeDetail("extracting", { id: "job-three", title: "Still working" }),
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
  await page.goto("/");
  await page.getByRole("button", { name: "Play First recording" }).click();
  const player = page.getByRole("dialog", { name: "Now playing" });
  await expect(
    player.getByRole("heading", { name: "First recording" })
  ).toBeVisible();
  await expect(page.locator("audio")).toHaveAttribute(
    "src",
    "/api/pipeline/jobs/job-one/audio"
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
  await page.getByRole("link", { name: /Still working/u }).click();
  await expect(
    page.getByRole("heading", { name: "Still working" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Library" }).click();
  expect(
    await first?.evaluate((audio) => audio === document.querySelector("audio"))
  ).toBe(true);
  await expect.poll(() => readAudio(page)).toMatchObject({ paused: false });

  await page.getByRole("button", { name: "Play Second recording" }).click();
  await expect
    .poll(() => readAudio(page))
    .toMatchObject({ duration: 60, paused: true, position: 24, rate: 1.5 });
  await expect(page.locator("audio")).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem("dyslexia:playback:job-one:job-one") ?? "null"
      )
    )
  ).toMatchObject({ rate: 1.25 });
});

test("review forms fit narrow screens and expose labelled keyboard controls", async ({
  page,
}) => {
  await page.setViewportSize({ height: 740, width: 320 });
  await mockPipeline(page, {
    details: [
      makeDetail("draft_ready", {
        title: "A".repeat(120),
        url: `https://example.com/${"long-path".repeat(20)}`,
      }),
    ],
  });
  await page.goto("/narrations/job-one");
  await expect(
    page.getByLabel("Narration text", { exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await Promise.all(
    [
      page.getByRole("link", { name: "Library" }),
      page.getByLabel("Narration text", { exact: true }),
      page.getByRole("button", { name: "Generate audio" }),
    ].map(async (control) => {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    })
  );
  const approval = page.getByRole("switch");
  await approval.focus();
  await page.keyboard.press("Space");
  await expect(approval).toBeChecked();
});
