import type { Narration } from "@dyslexia/narrations/client";
import type { Page, Route } from "@playwright/test";

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

const BASE = {
  createdAt: "2026-01-01T00:00:00Z",
  id: "job-one",
  title: "A new article",
  url: "https://example.com/article",
};

/** A narration in the given state, as the API returns it. */
export const makeNarration = (
  state: Narration["state"],
  overrides: Partial<typeof BASE> & {
    durationSeconds?: number;
    reason?: string;
  } = {}
): Narration => {
  const { durationSeconds = 60, reason, ...base } = overrides;
  const fields = { ...BASE, ...base };
  if (state === "ready") {
    return {
      ...fields,
      audioUrl: `/api/narrations/${fields.id}/audio`,
      durationSeconds,
      state,
    };
  }
  if (state === "failed") {
    return {
      ...fields,
      reason:
        reason ??
        "This page could not be read as an article. It may be blocked, behind a paywall, or not an article.",
      state,
    };
  }
  return { ...fields, stage: "reading", state };
};

/**
 * Stands in for the server: the session, Better Auth, and the narrations
 * API, with narrations held in memory. Returns the state so tests can
 * inspect requests and change narrations.
 */
export const mockNarrations = async (
  page: Page,
  options: {
    authenticated?: boolean;
    configured?: boolean;
    narrations?: Narration[];
  } = {}
) => {
  const mutations: { path: string; method: string; body: unknown }[] = [];
  const authRequests: { path: string; body: unknown }[] = [];
  const state = {
    authRequests,
    authenticated: options.authenticated ?? true,
    configured: options.configured ?? true,
    listRequests: 0,
    mutations,
    narrations: new Map(
      (options.narrations ?? []).map((narration) => [narration.id, narration])
    ),
  };
  // Stands in for Better Auth: Google immediately returns to the callback page.
  await page.route("**/api/auth/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/auth", "");
    state.authRequests.push({ body: request.postDataJSON(), path });
    if (path === "/get-session") {
      await route.fulfill({
        json: state.authenticated
          ? {
              session: { id: "session", userId: "reader" },
              user: {
                email: "reader@example.com",
                id: "reader",
                name: "Ada Reader",
              },
            }
          : null,
      });
    } else if (path === "/sign-in/social") {
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
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      json: {
        authenticated: state.authenticated,
        configured: state.configured,
      },
    });
  });
  await page.route(/\/api\/narrations(?:\/|$)/u, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/narrations", "");
    const method = request.method();
    if (method !== "GET") {
      state.mutations.push({
        body: request.postData() ? request.postDataJSON() : null,
        method,
        path,
      });
    }
    if (!state.authenticated) {
      await route.fulfill({ json: { _tag: "Unauthorized" }, status: 401 });
      return;
    }
    if (path === "" || path === "/") {
      if (method === "POST") {
        const narration = makeNarration("making", { id: "job-new" });
        state.narrations = new Map([
          [narration.id, narration],
          ...state.narrations,
        ]);
        await route.fulfill({ json: narration });
      } else {
        state.listRequests += 1;
        await route.fulfill({ json: [...state.narrations.values()] });
      }
      return;
    }
    const [, id = "", action] = path.split("/");
    const narration = state.narrations.get(id);
    if (!narration) {
      await route.fulfill({ json: { _tag: "NarrationNotFound" }, status: 404 });
    } else if (action === "audio") {
      await serveAudio(route);
    } else if (action === "retry" && method === "POST") {
      const next = makeNarration("making", {
        id: `${id}-again`,
        title: narration.title,
        url: narration.url,
      });
      state.narrations.delete(id);
      state.narrations = new Map([[next.id, next], ...state.narrations]);
      await route.fulfill({ json: next });
    } else if (method === "DELETE") {
      state.narrations.delete(id);
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({ json: { _tag: "NarrationNotFound" }, status: 404 });
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
 * A narration's row in a list, which opens the player. Its name starts with
 * the title; the row's own Play and more buttons are named after it.
 */
export const rowOf = (page: Page, title: string) =>
  page.getByRole("button", { name: new RegExp(`^${title}`, "u") });

/**
 * Opens the Library tab with one ready narration and opens its player. `audio`
 * replaces the recording's server, as for slow or missing audio.
 */
export const openPlayer = async (
  page: Page,
  audio?: (route: Route) => Promise<void>
) => {
  const state = await mockNarrations(page, {
    narrations: [makeNarration("ready")],
  });
  if (audio) {
    await page.route("**/api/narrations/job-one/audio", audio);
  }
  await page.goto("/library");
  await rowOf(page, "A new article").click();
  return state;
};
