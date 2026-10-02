import type { Page, Route } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ARTICLE } from "../src/lib/article";
import { PLAYBACK_STORAGE_KEY } from "../src/lib/playback";
import type {
  JobDetail,
  JobStatus,
  PipelineJob,
} from "../src/pipeline/contracts";

// The existing player fixture is private to player.spec.ts. Keep this small,
// deterministic WAV local to this suite; no provider or real recording is used.
const frames = 60 * 8000;
const wav = Buffer.alloc(44 + frames, 128);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + frames, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(8000, 28);
wav.writeUInt16LE(1, 32);
wav.writeUInt16LE(8, 34);
wav.write("data", 36);
wav.writeUInt32LE(frames, 40);

const serveAudio = async (route: Route) => {
  const range = route
    .request()
    .headers()
    .range?.match(/^bytes=(?<start>\d+)-(?<end>\d*)$/u);
  const start = Number(range?.groups?.start ?? 0);
  const end = range?.groups?.end
    ? Math.min(Number(range.groups.end), wav.length - 1)
    : wav.length - 1;
  await route.fulfill({
    body: wav.subarray(start, end + 1),
    contentType: "audio/wav",
    headers: range
      ? {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${wav.length}`,
        }
      : { "Accept-Ranges": "bytes" },
    status: range ? 206 : 200,
  });
};

const draftText = "A short narration worth hearing.";
const makeDetail = (
  status: JobStatus,
  overrides: Partial<PipelineJob> = {}
): JobDetail => ({
  draft: {
    sourceUrl: "https://example.com/article",
    text: draftText,
    title: "A new article",
  },
  job: {
    characters: draftText.length,
    completedChunks: 0,
    createdAt: "2026-01-01T00:00:00Z",
    durationSeconds: 60,
    estimatedTtsUsd: 0.42,
    id: "job-one",
    status,
    title: "A new article",
    totalChunks: 2,
    updatedAt: "2026-01-01T00:00:00Z",
    url: "https://example.com/article",
    ...overrides,
  },
  source: {
    markdown:
      "# A new article\n\nKeep this paragraph.\n\nDelete this navigation.",
    sourceUrl: "https://example.com/article",
    title: "A new article",
  },
});

const mockPipeline = async (
  page: Page,
  options: {
    authenticated?: boolean;
    configured?: boolean;
    details?: JobDetail[];
  } = {}
) => {
  const mutations: { path: string; method: string; body: unknown }[] = [];
  const state = {
    authenticated: options.authenticated ?? true,
    configured: options.configured ?? true,
    detailRequests: 0,
    details: new Map(
      (options.details ?? []).map((detail) => [detail.job.id, detail])
    ),
    jobsRequests: 0,
    mutations,
  };
  await page.route("**/api/pipeline/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/pipeline", "");
    const method = request.method();
    if (method !== "GET") {
      state.mutations.push({
        body: request.postData() ? request.postDataJSON() : null,
        method,
        path,
      });
    }
    if (path === "/session") {
      if (method === "POST") {
        state.authenticated = true;
      } else if (method === "DELETE") {
        state.authenticated = false;
      }
      await route.fulfill({
        json: {
          authenticated: state.authenticated,
          configured: state.configured,
        },
      });
      return;
    }
    if (!state.authenticated) {
      await route.fulfill({
        json: { error: "Sign in to continue." },
        status: 401,
      });
      return;
    }
    if (path === "/jobs") {
      if (method === "POST") {
        const detail = makeDetail("extracting");
        state.details.set(detail.job.id, detail);
        await route.fulfill({ json: { job: detail.job }, status: 202 });
      } else {
        state.jobsRequests += 1;
        await route.fulfill({
          json: {
            jobs: [...state.details.values()].map((detail) => detail.job),
          },
        });
      }
      return;
    }
    const [id, action] = path.split("/").slice(2);
    const detail = state.details.get(id);
    if (!detail) {
      await route.fulfill({
        json: { error: "Narration not found." },
        status: 404,
      });
      return;
    }
    if (action === "audio") {
      await serveAudio(route);
    } else if (method === "POST") {
      state.details.set(id, {
        ...detail,
        job: {
          ...detail.job,
          status: action === "source" ? "adapting" : "generating",
        },
      });
      await route.fulfill({ json: { ok: true }, status: 202 });
    } else {
      state.detailRequests += 1;
      await route.fulfill({ json: detail });
    }
  });
  return state;
};

const selectJob = (page: Page, title = "A new article") =>
  page.getByRole("button", { name: new RegExp(title, "u") }).click();

const audioState = (page: Page) =>
  page.locator("audio").evaluate((audio: HTMLAudioElement) => ({
    duration: audio.duration,
    paused: audio.paused,
    position: audio.currentTime,
    rate: audio.playbackRate,
  }));

const visible = (page: Page, state: "hidden" | "visible") =>
  page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

test.beforeEach(async ({ page }) => {
  await page.route(`**${ARTICLE.audioUrl}`, serveAudio);
});

test("personal login keeps tokens out of storage and supports logout", async ({
  page,
}) => {
  const state = await mockPipeline(page, { authenticated: false });
  await page.goto("/");
  await page.getByRole("link", { name: "Create narration" }).click();
  const token = page.getByLabel("Password", { exact: true });
  await expect(token).toHaveAttribute("type", "password");
  await expect(token).toHaveAttribute("autocomplete", "current-password");
  await token.fill("test-personal-token");
  await page.getByRole("button", { exact: true, name: "Sign in" }).click();
  await expect(page.getByLabel("Article URL", { exact: true })).toBeVisible();
  expect(state.mutations).toEqual([
    {
      body: { token: "test-personal-token" },
      method: "POST",
      path: "/session",
    },
  ]);
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        cookie: document.cookie,
        local: { ...localStorage },
        session: { ...sessionStorage },
      })
    )
  ).not.toContain("test-personal-token");
  await page.getByRole("button", { exact: true, name: "Sign out" }).click();
  await expect(token).toBeVisible();
  await expect(token).toHaveValue("");
  expect(state.mutations.at(-1)).toMatchObject({
    method: "DELETE",
    path: "/session",
  });
});

test("unconfigured service explains setup without showing a token field", async ({
  page,
}) => {
  const state = await mockPipeline(page, {
    authenticated: false,
    configured: false,
  });
  await page.goto("/create");
  await expect(
    page.getByRole("heading", { name: "Narration setup needed" })
  ).toBeVisible();
  await expect(
    page.getByText(/configure PIPELINE_ACCESS_TOKEN/u)
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  expect(state.jobsRequests).toBe(0);
});

test("submits an HTTPS link and displays source extraction progress", async ({
  page,
}) => {
  const state = await mockPipeline(page);
  await page.goto("/create");
  await page
    .getByLabel("Article URL", { exact: true })
    .fill("http://example.com/article");
  await page.getByRole("button", { exact: true, name: "Create draft" }).click();
  await expect(page.getByRole("alert")).toContainText("HTTPS");
  expect(state.mutations).toHaveLength(0);
  await page
    .getByLabel("Article URL", { exact: true })
    .fill("https://example.com/article");
  await page.getByRole("button", { exact: true, name: "Create draft" }).click();
  await expect(page.locator('[aria-current="step"]')).toHaveText(
    "Extract source"
  );
  expect(state.mutations).toEqual([
    {
      body: { url: "https://example.com/article" },
      method: "POST",
      path: "/jobs",
    },
  ]);
});

test("full extracted source is editable and only submitted deliberately", async ({
  page,
}) => {
  const state = await mockPipeline(page, {
    details: [makeDetail("source_ready")],
  });
  await page.goto("/create");
  await selectJob(page);
  await expect(
    page.getByLabel("Source Markdown", { exact: true })
  ).toContainText("Delete this navigation.");
  await page
    .getByLabel("Article title", { exact: true })
    .fill("Selected article");
  await page
    .getByLabel("Source Markdown", { exact: true })
    .fill("# Selected article\n\nKeep this paragraph.");
  expect(state.mutations).toHaveLength(0);
  await page.getByRole("button", { name: "Adapt selected text" }).click();
  await expect(page.locator('[aria-current="step"]')).toHaveText("Adapt text");
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

test("draft review shows per-job costs and needs explicit approval", async ({
  page,
}) => {
  const state = await mockPipeline(page, {
    details: [makeDetail("draft_ready")],
  });
  await page.goto("/create");
  await selectJob(page);
  await expect(page.getByText("$0.42 USD", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Excludes LLM adaptation, extraction/u)
  ).toBeVisible();
  await expect(
    page.getByLabel("Maximum approved speech cost (USD)", { exact: true })
  ).toHaveValue("10");
  await page
    .getByRole("button", { name: "Confirm and generate audio" })
    .click();
  expect(state.mutations).toHaveLength(0);
  await page
    .getByLabel("Narration title", { exact: true })
    .fill("My edited narration");
  await page
    .getByLabel("Narration text", { exact: true })
    .fill("Edited narration.");
  await page
    .getByLabel("Maximum approved speech cost (USD)", { exact: true })
    .fill("0.01");
  await expect(page.getByRole("alert")).toContainText(
    "covers the estimated speech cost"
  );
  await page
    .getByLabel("Maximum approved speech cost (USD)", { exact: true })
    .fill("2");
  await page
    .getByRole("checkbox", { name: /I approve speech generation/u })
    .check();
  await page
    .getByLabel("Narration text", { exact: true })
    .fill("Final edited narration.");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(state.mutations).toHaveLength(0);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm and generate audio" })
    .click();
  await expect(page.locator('[aria-current="step"]')).toHaveText(
    "Generate speech"
  );
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
    await page.goto("/create");
    await selectJob(page);
    await expect(page.getByRole("alert")).toContainText("No automatic retry");
    await expect(page.getByRole("alert")).toContainText(
      "Provider outcome requires review."
    );
    if (status === "uncertain") {
      await expect(page.getByRole("alert")).toContainText(
        "generated or billed"
      );
    }
    const requests = state.jobsRequests;
    await page.clock.fastForward(12_000);
    expect(state.jobsRequests).toBe(requests);
    expect(state.mutations).toHaveLength(0);
    await expect(
      page.getByRole("button", { name: "Confirm and generate audio" })
    ).toHaveCount(0);
  });
}

test("polls active jobs only while visible and stops after navigation", async ({
  page,
}) => {
  await page.clock.install();
  const state = await mockPipeline(page, {
    details: [makeDetail("extracting")],
  });
  await page.goto("/create");
  await selectJob(page);
  await expect(page.locator('[aria-current="step"]')).toHaveText(
    "Extract source"
  );
  const before = state.jobsRequests;
  await page.clock.fastForward(3000);
  await expect.poll(() => state.jobsRequests).toBeGreaterThan(before);
  await visible(page, "hidden");
  const hidden = state.jobsRequests;
  await page.clock.fastForward(12_000);
  expect(state.jobsRequests).toBe(hidden);
  state.details.set("job-one", makeDetail("source_ready"));
  await visible(page, "visible");
  await expect(
    page.getByLabel("Source Markdown", { exact: true })
  ).toBeVisible();
  const idle = state.jobsRequests;
  await page.clock.fastForward(12_000);
  expect(state.jobsRequests).toBe(idle);
  state.details.set("job-one", makeDetail("adapting"));
  await page.getByRole("button", { name: "Refresh jobs" }).click();
  await expect(page.locator('[aria-current="step"]')).toHaveText("Adapt text");
  await page.getByRole("link", { exact: true, name: "Home" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: ARTICLE.title })
  ).toBeVisible();
  const left = state.jobsRequests;
  await page.clock.fastForward(12_000);
  expect(state.jobsRequests).toBe(left);
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
  await page.goto("/create");
  await expect(
    page.getByRole("button", { name: /A new article/u })
  ).toBeVisible();
  const pending: Route[] = [];
  await page.route("**/api/pipeline/jobs", (route) => {
    pending.push(route);
  });
  await page.clock.fastForward(3000);
  await expect.poll(() => pending.length).toBe(1);
  await page.clock.fastForward(12_000);
  expect(pending).toHaveLength(1);
  await visible(page, "hidden");
  await expect(page.locator("html")).toHaveAttribute(
    "data-jobs-aborted",
    "true"
  );
  await page.clock.fastForward(12_000);
  expect(pending).toHaveLength(1);
  await Promise.all(pending.map((route) => route.abort()));
});

test("session expiry clears private jobs and offers sign-in", async ({
  page,
}) => {
  await page.clock.install();
  const state = await mockPipeline(page, {
    details: [makeDetail("extracting")],
  });
  await page.goto("/create");
  await selectJob(page);
  await expect(page.locator('[aria-current="step"]')).toHaveText(
    "Extract source"
  );
  state.authenticated = false;
  await page.clock.fastForward(3000);
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Sign in to continue.");
  await expect(
    page.getByRole("heading", { name: "A new article" })
  ).toHaveCount(0);
});

test("selecting ready audio changes metadata and progress without navigation remounts", async ({
  page,
}) => {
  const detail = makeDetail("ready", { title: "My ready recording" });
  await mockPipeline(page, { details: [detail] });
  const selectedKey = "dyslexia:playback:job-one:job-one";
  await page.addInitScript(
    ({ original, selected }) => {
      localStorage.setItem(
        original,
        JSON.stringify({ position: 8, rate: 1.25 })
      );
      localStorage.setItem(
        selected,
        JSON.stringify({ position: 24, rate: 1.5 })
      );
    },
    { original: PLAYBACK_STORAGE_KEY, selected: selectedKey }
  );
  await page.goto("/");
  await expect
    .poll(() => audioState(page))
    .toMatchObject({ duration: 60, position: 8 });
  const originalAudio = await page.locator("audio").elementHandle();
  await page.getByRole("link", { name: "Create narration" }).click();
  expect(
    await originalAudio?.evaluate(
      (audio) => audio === document.querySelector("audio")
    )
  ).toBe(true);
  await selectJob(page, "My ready recording");
  await page.getByRole("link", { exact: true, name: "Listen" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "My ready recording" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Listen: My ready recording" })
  ).toBeVisible();
  await expect(page.locator("audio")).toHaveAttribute(
    "src",
    "/api/pipeline/jobs/job-one/audio"
  );
  await expect
    .poll(() => audioState(page))
    .toMatchObject({ duration: 60, paused: true, position: 24, rate: 1.5 });
  expect(
    await originalAudio?.evaluate(
      (audio) => audio === document.querySelector("audio")
    )
  ).toBe(false);
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
      artist: "Your narration",
      title: "My ready recording",
    });
  }
  await page.getByRole("button", { name: "seek forward 15 seconds" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
        selectedKey
      )
    )
    .toEqual({ position: 39, rate: 1.5 });
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
      PLAYBACK_STORAGE_KEY
    )
  ).toEqual({ position: 8, rate: 1.25 });
  await page.getByRole("button", { exact: true, name: "play" }).click();
  const selectedAudio = await page.locator("audio").elementHandle();
  await page.getByRole("link", { name: "Create narration" }).click();
  await page.getByRole("link", { exact: true, name: "Home" }).click();
  expect(
    await selectedAudio?.evaluate(
      (audio) => audio === document.querySelector("audio")
    )
  ).toBe(true);
  await expect.poll(() => audioState(page)).toMatchObject({ paused: false });
  await page
    .getByRole("button", { name: "Listen to the original recording" })
    .click();
  await expect
    .poll(() => audioState(page))
    .toMatchObject({ duration: 60, paused: true, position: 8, rate: 1.25 });
  await expect(page.locator("audio")).toHaveCount(1);
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
  await page.goto("/create");
  await selectJob(page, "A".repeat(120));
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
      page.getByLabel("Article URL", { exact: true }),
      page.getByLabel("Narration text", { exact: true }),
      page.getByRole("button", { name: "Confirm and generate audio" }),
    ].map(async (control) => {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    })
  );
  await page.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox")).toBeChecked();
});
