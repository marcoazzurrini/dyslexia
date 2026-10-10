import type { Page, Route } from "@playwright/test";
import { expect, test } from "@playwright/test";

import {
  makeNarration,
  mockNarrations,
  openPlayer,
  PLAYBACK_KEY,
  readAudio,
  rowOf,
  serveAudio,
} from "./fixtures";

const audioValue = async <
  Key extends keyof Awaited<ReturnType<typeof readAudio>>,
>(
  page: Page,
  key: Key
) => {
  const state = await readAudio(page);
  return state[key];
};

const player = (page: Page) =>
  page.getByRole("dialog", { name: "Now playing" });

const ready = async (page: Page) => {
  await expect.poll(() => audioValue(page, "duration")).toBe(60);
  await expect(
    player(page).getByRole("button", { exact: true, name: "play" })
  ).toBeVisible();
};

const speed = (page: Page, rate: string) =>
  player(page).getByRole("radio", { exact: true, name: `${rate}×` });

const seedProgress = async (page: Page, saved: string) => {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: PLAYBACK_KEY, value: saved }
  );
};

const readSaved = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
    PLAYBACK_KEY
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

test("native playback, pause, skip, seek, and keyboard controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openPlayer(page);
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
  await player(page).getByRole("button", { exact: true, name: "play" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("audio")).toHaveAttribute("data-did-play", "true");
  await expect.poll(() => audioValue(page, "position")).toBeGreaterThan(0);
  await player(page)
    .getByRole("button", { exact: true, name: "pause" })
    .click();
  await expect(page.locator("audio")).toHaveAttribute("data-did-pause", "true");
  expect(await audioValue(page, "paused")).toBe(true);
  const start = await audioValue(page, "position");
  await player(page)
    .getByRole("button", { name: "seek forward 15 seconds" })
    .click();
  await expect
    .poll(() => audioValue(page, "position"))
    .toBeCloseTo(start + 15, 0);
  await player(page)
    .getByRole("button", { name: "seek back 15 seconds" })
    .click();
  await expect.poll(() => audioValue(page, "position")).toBeCloseTo(start, 0);
  await player(page).getByRole("slider", { exact: true, name: "seek" }).focus();
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
    await openPlayer(page);
    await ready(page);
    await speed(page, rate).click();
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
  await openPlayer(page, async (route) => {
    if (released) {
      await serveAudio(route);
    } else {
      pendingRoutes.push(route);
    }
  });
  await expect(speed(page, "1.5")).toBeChecked();
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
  await openPlayer(page);
  await ready(page);
  await player(page)
    .getByRole("button", { name: "seek forward 15 seconds" })
    .click();
  await speed(page, "1.25").click();
  await expect
    .poll(() => readSaved(page))
    .toMatchObject({ position: 15, rate: 1.25 });
  await page.reload();
  // The recording comes back in the mini player, closed and paused.
  await page
    .getByRole("button", { name: "Open player: A new article" })
    .click();
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
    await openPlayer(page);
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
  await openPlayer(page);
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
  await openPlayer(page);
  await ready(page);
  await player(page).getByRole("button", { exact: true, name: "play" }).click();
  await expect.poll(() => audioValue(page, "paused")).toBe(false);
  await player(page)
    .getByRole("button", { exact: true, name: "pause" })
    .click();
  await speed(page, "2").click();
  expect(await audioValue(page, "rate")).toBe(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("missing media shows an error and retries from a user gesture", async ({
  page,
}) => {
  let missing = true;
  await openPlayer(page, (route) =>
    missing
      ? route.fulfill({
          body: "Not found",
          contentType: "text/plain",
          status: 404,
        })
      : serveAudio(route)
  );
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
  await openPlayer(page);
  await ready(page);
  await speed(page, "1.5").click();
  await player(page)
    .getByRole("button", { name: "seek forward 15 seconds" })
    .click();
  await expect.poll(() => savedValue(page, "position")).toBe(15);
  await player(page).getByRole("button", { exact: true, name: "play" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Retry playback" }).click();
  await expect.poll(() => audioValue(page, "position")).toBeGreaterThan(15);
  expect(await audioValue(page, "rate")).toBe(1.5);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a fetch stall does not show loading while buffered audio plays", async ({
  page,
}) => {
  await openPlayer(page);
  await ready(page);
  await player(page).getByRole("button", { exact: true, name: "play" }).click();
  await expect(player(page).getByRole("status")).toHaveText("Playing");
  await page.locator("audio").evaluate((audio) => {
    audio.dispatchEvent(new Event("stalled"));
  });
  await expect(player(page).getByRole("status")).toHaveText("Playing");
});

test("controls fit a narrow screen with accessible touch targets", async ({
  page,
}) => {
  await page.setViewportSize({ height: 740, width: 320 });
  await openPlayer(page);
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  const controls = [
    player(page).getByRole("button", { exact: true, name: "play" }),
    player(page).getByRole("button", { name: "seek back 15 seconds" }),
    player(page).getByRole("button", { name: "seek forward 15 seconds" }),
    player(page).getByRole("slider", { exact: true, name: "seek" }),
    speed(page, "1.5"),
  ];
  await Promise.all(
    controls.map(async (control) => {
      // The sheet may still be settling, so its box can be a hair off whole.
      const box = await control.boundingBox();
      const tag = await control.evaluate((element) => element.tagName);
      expect(
        Math.round(box?.height ?? 0),
        `${tag} touch target height`
      ).toBeGreaterThanOrEqual(44);
      expect(
        Math.round(box?.width ?? 0),
        `${tag} touch target width`
      ).toBeGreaterThanOrEqual(44);
    })
  );
});

/**
 * Records, on every frame, the highest the open sheet's panel reaches. Its own
 * name lets it schedule itself once serialized to the page.
 */
const recordHighest = function recordHighest() {
  const panel = document.querySelector("dialog[open] > :last-child");
  if (panel) {
    const { top } = panel.getBoundingClientRect();
    const highest = Number(document.body.dataset.highest ?? Infinity);
    document.body.dataset.highest = String(Math.min(highest, top));
  }
  requestAnimationFrame(recordHighest);
};

test("the player slides up without passing its place", async ({ page }) => {
  await mockNarrations(page, { narrations: [makeNarration("ready")] });
  await page.route("**/api/narrations/job-one/audio", serveAudio);
  await page.goto("/library");
  await page.evaluate(recordHighest);
  await rowOf(page, "A new article").click();
  // The sheet settles within its 500ms spring.
  await page.waitForTimeout(1000);
  const reached = await page.evaluate(() =>
    Number(document.body.dataset.highest)
  );
  const rest = await player(page)
    .locator(":scope > :last-child")
    .evaluate((panel) => panel.getBoundingClientRect().top);
  expect(reached).toBeGreaterThanOrEqual(rest - 1);
});

test("hidden visibility saves without pausing native playback", async ({
  page,
}) => {
  await openPlayer(page);
  await ready(page);
  await player(page).getByRole("button", { exact: true, name: "play" }).click();
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
  await openPlayer(page);
  await ready(page);
  const metadata = await page.evaluate(() => ({
    artist: navigator.mediaSession.metadata?.artist,
    artwork: navigator.mediaSession.metadata?.artwork,
    title: navigator.mediaSession.metadata?.title,
  }));
  expect(metadata).toMatchObject({
    artist: "example.com",
    title: "A new article",
  });
  expect(metadata.artwork).toHaveLength(2);
  await mediaAction(page, { action: "seekto", seekTime: 30 });
  await expect.poll(() => audioValue(page, "position")).toBe(30);
  await mediaAction(page, { action: "seekbackward" });
  await expect.poll(() => audioValue(page, "position")).toBe(15);
  await mediaAction(page, { action: "seekto", seekTime: Number.NaN });
  expect(await audioValue(page, "position")).toBe(15);
  // First start remains a real user gesture; platform resume is then exercised.
  await player(page).getByRole("button", { exact: true, name: "play" }).click();
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

test("a row's Play button plays in place, and pauses while it plays", async ({
  page,
}) => {
  await mockNarrations(page, { narrations: [makeNarration("ready")] });
  await page.route("**/api/narrations/job-one/audio", serveAudio);
  await page.goto("/library");
  await page.getByRole("button", { name: "Play A new article" }).click();
  await expect.poll(() => audioValue(page, "paused")).toBe(false);
  // The player stays closed, in reach in the mini player.
  await expect(player(page)).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Open player: A new article" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause A new article" }).click();
  await expect.poll(() => audioValue(page, "paused")).toBe(true);
  await expect(
    page.getByRole("button", { name: "Play A new article" })
  ).toBeVisible();
  // Pressing the row opens the player, without playing.
  await rowOf(page, "A new article").click();
  await expect(player(page)).toBeVisible();
  expect(await audioValue(page, "paused")).toBe(true);
});

test("playing another row switches recordings, and each keeps its place", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "dyslexia:playback:job-two:job-two",
      JSON.stringify({ position: 24, rate: 1.5 })
    );
  });
  await mockNarrations(page, {
    narrations: [
      makeNarration("ready"),
      makeNarration("ready", { id: "job-two", title: "Second" }),
    ],
  });
  await page.route("**/api/narrations/*/audio", serveAudio);
  await page.goto("/library");
  await page.getByRole("button", { name: "Play A new article" }).click();
  await expect.poll(() => audioValue(page, "position")).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Play Second" }).click();
  await expect
    .poll(() => readAudio(page))
    .toMatchObject({ paused: false, rate: 1.5 });
  expect(await audioValue(page, "position")).toBeGreaterThanOrEqual(24);
  await expect(
    page.getByRole("button", { name: "Pause Second" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play A new article" })
  ).toBeVisible();
  const first = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("dyslexia:playback:job-one:job-one") ?? "null"
    )
  );
  expect(first.position).toBeGreaterThan(0);
  expect(first.position).toBeLessThan(24);
});
