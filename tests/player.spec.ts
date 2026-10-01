import type { Page, Route } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ARTICLE } from "../src/lib/article";
import { PLAYBACK_STORAGE_KEY } from "../src/lib/playback";

// One minute of deterministic, silent 8-bit PCM. These tests use the browser's
// native decoder, never ElevenLabs or the full production narration.
const sampleRate = 8000;
const frames = 60 * sampleRate;
const wav = Buffer.alloc(44 + frames, 128);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + frames, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate, 28);
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

const readAudio = (page: Page) =>
  page.locator("audio").evaluate((audio: HTMLAudioElement) => ({
    duration: audio.duration,
    paused: audio.paused,
    pitch: audio.preservesPitch,
    position: audio.currentTime,
    rate: audio.playbackRate,
  }));

const audioValue = async <
  Key extends keyof Awaited<ReturnType<typeof readAudio>>,
>(
  page: Page,
  key: Key
) => {
  const state = await readAudio(page);
  return state[key];
};

const ready = async (page: Page) => {
  await expect.poll(() => audioValue(page, "duration")).toBe(60);
  await expect(
    page.getByRole("button", { exact: true, name: "play" })
  ).toBeVisible();
};

const seedProgress = async (page: Page, saved: string) => {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: PLAYBACK_STORAGE_KEY, value: saved }
  );
};

const readSaved = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
    PLAYBACK_STORAGE_KEY
  );

const savedValue = async (page: Page, key: "position" | "rate") => {
  const state = await readSaved(page);
  return state?.[key];
};

const mediaAction = (page: Page, detail: MediaSessionActionDetails) =>
  page.evaluate((details) => {
    document.dispatchEvent(
      new CustomEvent("test-media-action", { detail: details })
    );
  }, detail);

test.beforeEach(async ({ page }) => {
  await page.route(`**${ARTICLE.audioUrl}`, serveAudio);
});

test("native playback, pause, skip, seek, and keyboard controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await ready(page);
  expect(await readAudio(page)).toMatchObject({
    paused: true,
    pitch: true,
    position: 0,
    rate: 1,
  });
  await page.locator("audio").evaluate((audio) => {
    audio.addEventListener("playing", () => {
      audio.dataset.didPlay = "true";
    });
    audio.addEventListener("pause", () => {
      audio.dataset.didPause = "true";
    });
    audio.addEventListener("seeked", () => {
      audio.dataset.didSeek = "true";
    });
  });
  await page.getByRole("button", { exact: true, name: "play" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("audio")).toHaveAttribute("data-did-play", "true");
  await expect.poll(() => audioValue(page, "position")).toBeGreaterThan(0);
  await page.getByRole("button", { exact: true, name: "pause" }).click();
  await expect(page.locator("audio")).toHaveAttribute("data-did-pause", "true");
  expect(await audioValue(page, "paused")).toBe(true);
  const start = await audioValue(page, "position");
  await page.getByRole("button", { name: "seek forward 15 seconds" }).click();
  await expect
    .poll(() => audioValue(page, "position"))
    .toBeCloseTo(start + 15, 0);
  await page.getByRole("button", { name: "seek back 15 seconds" }).click();
  await expect.poll(() => audioValue(page, "position")).toBeCloseTo(start, 0);
  await page.getByRole("slider", { exact: true, name: "seek" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => audioValue(page, "position")).toBeGreaterThan(start);
  await expect(page.locator("audio")).toHaveAttribute("data-did-seek", "true");
  await expect.poll(() => savedValue(page, "position")).toBeGreaterThan(start);
  expect(errors).toEqual([]);
});

for (const rate of ["0.75", "1", "1.25", "1.5", "2"]) {
  test(`sets native speed to ${rate} with pitch preservation`, async ({
    page,
  }) => {
    await page.goto("/");
    await ready(page);
    await page.getByLabel("Speed", { exact: true }).selectOption(rate);
    await expect.poll(() => audioValue(page, "rate")).toBe(Number(rate));
    expect(await audioValue(page, "pitch")).toBe(true);
    await expect.poll(() => savedValue(page, "rate")).toBe(Number(rate));
  });
}

test("restores versioned position only after metadata without autoplay", async ({
  page,
}) => {
  await seedProgress(page, JSON.stringify({ position: 24, rate: 1.5 }));
  // Engines may probe metadata with multiple concurrent range requests.
  // Hold every request behind one gate rather than losing earlier probes.
  const pendingRoutes: Route[] = [];
  let released = false;
  await page.route(`**${ARTICLE.audioUrl}`, async (route) => {
    if (released) {
      await serveAudio(route);
    } else {
      pendingRoutes.push(route);
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Speed", { exact: true })).toHaveValue("1.5");
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await readSaved(page)).toEqual({ position: 24, rate: 1.5 });
  expect(await audioValue(page, "position")).toBe(0);
  expect(await audioValue(page, "rate")).toBe(1);
  await expect.poll(() => pendingRoutes.length).toBeGreaterThan(0);
  released = true;
  await Promise.all(pendingRoutes.map(serveAudio));
  // Include the native decoder state if delayed metadata fails on an engine.
  await expect
    .poll(async () => {
      const media = await page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => ({
          duration: audio.duration,
          error: audio.error && {
            code: audio.error.code,
            message: audio.error.message,
          },
          network: audio.networkState,
          ready: audio.readyState,
        }));
      return JSON.stringify({
        media,
        ranges: pendingRoutes.map((route) => route.request().headers().range),
      });
    })
    .toContain('"duration":60');
  await ready(page);
  await expect.poll(() => audioValue(page, "position")).toBeCloseTo(24, 1);
  expect(await readAudio(page)).toMatchObject({
    paused: true,
    pitch: true,
    rate: 1.5,
  });
});

test("persists progress and rate across reload", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: "seek forward 15 seconds" }).click();
  await page.getByLabel("Speed", { exact: true }).selectOption("1.25");
  await expect
    .poll(() => readSaved(page))
    .toEqual({ position: 15, rate: 1.25 });
  await page.reload();
  await ready(page);
  await expect.poll(() => audioValue(page, "position")).toBeCloseTo(15, 1);
  expect(await readAudio(page)).toMatchObject({ paused: true, rate: 1.25 });
});

for (const saved of [
  "{broken",
  "null",
  "[]",
  '{"position":-4,"rate":1}',
  '{"position":"24","rate":2}',
  '{"position":12,"rate":99}',
  '{"position":1e999,"rate":1}',
]) {
  test(`ignores malformed saved progress: ${saved}`, async ({ page }) => {
    await seedProgress(page, saved);
    await page.goto("/");
    await ready(page);
    expect(await readAudio(page)).toMatchObject({
      paused: true,
      position: 0,
      rate: 1,
    });
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("clamps saved position to the loaded recording duration", async ({
  page,
}) => {
  await seedProgress(page, JSON.stringify({ position: 9999, rate: 0.75 }));
  await page.goto("/");
  await ready(page);
  await expect.poll(() => audioValue(page, "position")).toBe(60);
  expect(await audioValue(page, "paused")).toBe(true);
});

test("storage and missing platform APIs cannot break playback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaSession", { value: undefined });
    Object.defineProperty(navigator, "audioSession", { value: undefined });
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { exact: true, name: "play" }).click();
  await expect.poll(() => audioValue(page, "paused")).toBe(false);
  await page.getByRole("button", { exact: true, name: "pause" }).click();
  await page.getByLabel("Speed", { exact: true }).selectOption("2");
  expect(await audioValue(page, "rate")).toBe(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("missing media shows an error and retries from a user gesture", async ({
  page,
}) => {
  let missing = true;
  await page.route(`**${ARTICLE.audioUrl}`, (route) =>
    missing
      ? route.fulfill({
          body: "Not found",
          contentType: "text/plain",
          status: 404,
        })
      : serveAudio(route)
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Audio could not play");
  expect(await audioValue(page, "paused")).toBe(true);
  missing = false;
  await page.getByRole("button", { name: "Retry playback" }).click();
  await expect.poll(() => audioValue(page, "paused")).toBe(false);
  await expect.poll(() => audioValue(page, "position")).toBeGreaterThan(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("play rejection is visible and recoverable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    let rejected = false;
    HTMLMediaElement.prototype.play = async function play() {
      if (!rejected) {
        rejected = true;
        throw new DOMException("Gesture required", "NotAllowedError");
      }
      await original.call(this);
    };
  });
  await page.goto("/");
  await ready(page);
  await page.getByLabel("Speed", { exact: true }).selectOption("1.5");
  await page.getByRole("button", { name: "seek forward 15 seconds" }).click();
  await expect.poll(() => savedValue(page, "position")).toBe(15);
  await page.getByRole("button", { exact: true, name: "play" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Retry playback" }).click();
  await expect.poll(() => audioValue(page, "position")).toBeGreaterThan(15);
  expect(await audioValue(page, "rate")).toBe(1.5);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("client navigation preserves the exact playing audio element", async ({
  page,
}) => {
  await page.goto("/not-a-real-page");
  await ready(page);
  await page.getByRole("button", { exact: true, name: "play" }).click();
  await expect.poll(() => audioValue(page, "position")).toBeGreaterThan(0);
  const audio = await page.locator("audio").elementHandle();
  const position = await audioValue(page, "position");
  await page.getByRole("link", { name: "Return home" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: ARTICLE.title })
  ).toBeVisible();
  expect(
    await audio?.evaluate(
      (element) => element === document.querySelector("audio")
    )
  ).toBe(true);
  await expect
    .poll(() => audioValue(page, "position"))
    .toBeGreaterThan(position);
  expect(await audioValue(page, "paused")).toBe(false);
  await expect(page.locator("audio")).toHaveCount(1);
});

test("a fetch stall does not show loading while buffered audio plays", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { exact: true, name: "play" }).click();
  await expect(page.getByRole("status")).toHaveText("Playing");
  await page.locator("audio").evaluate((audio) => {
    audio.dispatchEvent(new Event("stalled"));
  });
  await expect(page.getByRole("status")).toHaveText("Playing");
});

test("controls fit a narrow screen with accessible touch targets", async ({
  page,
}) => {
  await page.setViewportSize({ height: 740, width: 320 });
  await page.goto("/");
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  const controls = [
    page.getByRole("button", { exact: true, name: "play" }),
    page.getByRole("button", { name: "seek back 15 seconds" }),
    page.getByRole("button", { name: "seek forward 15 seconds" }),
    page.getByRole("slider", { exact: true, name: "seek" }),
    page.getByLabel("Speed", { exact: true }),
  ];
  await Promise.all(
    controls.map(async (control) => {
      const box = await control.boundingBox();
      const tag = await control.evaluate((element) => element.tagName);
      expect(box?.height, `${tag} touch target height`).toBeGreaterThanOrEqual(
        44
      );
      expect(box?.width, `${tag} touch target width`).toBeGreaterThanOrEqual(
        44
      );
    })
  );
});

test("hidden visibility saves without pausing native playback", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { exact: true, name: "play" }).click();
  await expect.poll(() => audioValue(page, "position")).toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await audioValue(page, "paused")).toBe(false);
  expect(await savedValue(page, "position")).toBeGreaterThan(0);
});

test("Media Session metadata, actions, and valid position state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const handlers = new Map<MediaSessionAction, MediaSessionActionHandler>();
    Object.defineProperty(navigator, "audioSession", {
      value: { type: "auto" },
    });
    Object.defineProperty(navigator, "mediaSession", {
      value: {
        metadata: null,
        playbackState: "none",
        setActionHandler(
          action: MediaSessionAction,
          handler: MediaSessionActionHandler | null
        ) {
          if (action === "seekforward") {
            throw new DOMException("Unsupported action", "NotSupportedError");
          }
          if (handler) {
            handlers.set(action, handler);
          } else {
            handlers.delete(action);
          }
        },
        setPositionState(state: MediaPositionState) {
          document.documentElement.dataset.positionState =
            JSON.stringify(state);
        },
      },
    });
    document.addEventListener("test-media-action", (event) => {
      if (event instanceof CustomEvent) {
        const details: MediaSessionActionDetails = event.detail;
        handlers.get(details.action)?.(details);
      }
    });
  });
  await page.goto("/");
  await ready(page);
  const metadata = await page.evaluate(() => ({
    artist: navigator.mediaSession.metadata?.artist,
    artwork: navigator.mediaSession.metadata?.artwork,
    title: navigator.mediaSession.metadata?.title,
  }));
  expect(metadata).toMatchObject({
    artist: ARTICLE.author,
    title: ARTICLE.title,
  });
  expect(metadata.artwork).toHaveLength(2);
  await mediaAction(page, { action: "seekto", seekTime: 30 });
  await expect.poll(() => audioValue(page, "position")).toBe(30);
  await mediaAction(page, { action: "seekbackward" });
  await expect.poll(() => audioValue(page, "position")).toBe(15);
  await mediaAction(page, { action: "seekto", seekTime: Number.NaN });
  expect(await audioValue(page, "position")).toBe(15);
  // First start remains a real user gesture; platform resume is then exercised.
  await page.getByRole("button", { exact: true, name: "play" }).click();
  await expect.poll(() => audioValue(page, "paused")).toBe(false);
  await mediaAction(page, { action: "pause" });
  await expect.poll(() => audioValue(page, "paused")).toBe(true);
  await mediaAction(page, { action: "play" });
  await expect.poll(() => audioValue(page, "paused")).toBe(false);
  const positionState = await page.evaluate(() =>
    JSON.parse(document.documentElement.dataset.positionState ?? "null")
  );
  expect(positionState.duration).toBe(60);
  expect(positionState.position).toBeGreaterThanOrEqual(15);
  expect(positionState.position).toBeLessThanOrEqual(60);
  expect(positionState.playbackRate).toBe(1);
});
