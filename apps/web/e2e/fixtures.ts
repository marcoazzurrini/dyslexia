import type { Page, Route } from "@playwright/test";

import type {
  JobDetail,
  JobStatus,
  PipelineJob,
} from "../src/pipeline/contracts";

// One minute of deterministic, silent 8-bit PCM. Tests use the browser's
// native decoder, never a provider or a real recording.
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

export const serveAudio = async (route: Route) => {
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

export const draftText = "A short narration worth hearing.";
export const makeDetail = (
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

/**
 * Stands in for the server: the session, Better Auth, and the pipeline API,
 * with jobs held in memory. Returns the state so tests can inspect requests.
 */
export const mockPipeline = async (
  page: Page,
  options: {
    authenticated?: boolean;
    configured?: boolean;
    details?: JobDetail[];
  } = {}
) => {
  const mutations: { path: string; method: string; body: unknown }[] = [];
  const authRequests: { path: string; body: unknown }[] = [];
  const state = {
    authRequests,
    authenticated: options.authenticated ?? true,
    configured: options.configured ?? true,
    detailRequests: 0,
    details: new Map(
      (options.details ?? []).map((detail) => [detail.job.id, detail])
    ),
    jobsRequests: 0,
    mutations,
  };
  // Stands in for Better Auth: Google immediately returns to the callback page.
  await page.route("**/api/auth/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/auth", "");
    state.authRequests.push({ body: request.postDataJSON(), path });
    if (path === "/sign-in/social") {
      state.authenticated = true;
      // SAFETY: the sign-in button always sends callbackURL; the sign-in
      // test asserts the full request body.
      const { callbackURL } = request.postDataJSON() as { callbackURL: string };
      await route.fulfill({ json: { redirect: true, url: callbackURL } });
    } else {
      state.authenticated = false;
      await route.fulfill({ json: { success: true } });
    }
  });
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

/** Pretends the page became hidden or visible, as when switching apps. */
export const setVisibility = (page: Page, state: "hidden" | "visible") =>
  page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

export const readAudio = (page: Page) =>
  page.locator("audio").evaluate((audio: HTMLAudioElement) => ({
    duration: audio.duration,
    paused: audio.paused,
    pitch: audio.preservesPitch,
    position: audio.currentTime,
    rate: audio.playbackRate,
  }));

/** Where the fixture recording's position and speed are saved. */
export const PLAYBACK_KEY = "dyslexia:playback:job-one:job-one";

/**
 * Opens the library with one ready narration and opens its player. `audio`
 * replaces the recording's server, as for slow or missing audio.
 */
export const openPlayer = async (
  page: Page,
  audio?: (route: Route) => Promise<void>
) => {
  const state = await mockPipeline(page, { details: [makeDetail("ready")] });
  if (audio) {
    await page.route("**/api/pipeline/jobs/job-one/audio", audio);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Play A new article" }).click();
  return state;
};
