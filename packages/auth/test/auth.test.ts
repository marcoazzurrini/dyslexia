import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ACCOUNT_NOT_ALLOWED, createAuth } from "../src/server.ts";

const BASE = "https://app.example";
const options = {
  allowedEmails: ["Me@Example.com"],
  baseUrl: BASE,
  google: { clientId: "client-id", clientSecret: "client-secret" },
  secret: "a-test-secret-that-is-at-least-32-characters-long",
};

interface Profile {
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

const me: Profile = {
  email: "me@example.com",
  email_verified: true,
  name: "Me",
  picture: "https://example.com/me.png",
};

// Google returns the ID token from its token endpoint over TLS, so Better
// Auth decodes it without a signature check. An unsigned token is enough.
const encode = (json: string) => Buffer.from(json).toString("base64url");
const idToken = (profile: Profile) =>
  `${encode('{"alg":"none","typ":"JWT"}')}.${encode(
    JSON.stringify({
      aud: options.google.clientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      iss: "https://accounts.google.com",
      sub: `google-${profile.email}`,
      ...profile,
    })
  )}.`;

let profile = me;
const realFetch = globalThis.fetch;
beforeEach(() => {
  profile = me;
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.href === "https://oauth2.googleapis.com/token") {
        return Promise.resolve(
          Response.json({
            access_token: "access-token",
            expires_in: 3600,
            id_token: idToken(profile),
            token_type: "Bearer",
          })
        );
      }
      return Promise.reject(new Error(`Unexpected request to ${url.href}`));
    },
    { preconnect: realFetch.preconnect }
  ) satisfies typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// A minimal browser cookie jar: later cookies replace earlier ones.
const jar = () => {
  const cookies = new Map<string, string>();
  return {
    header: () =>
      [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
    store(response: Response) {
      for (const cookie of response.headers.getSetCookie()) {
        const [pair = ""] = cookie.split(";");
        const index = pair.indexOf("=");
        const name = pair.slice(0, index);
        const value = pair.slice(index + 1);
        const expired = /max-age=0/iu.test(cookie) || value === "";
        if (expired) {
          cookies.delete(name);
        } else {
          cookies.set(name, value);
        }
      }
    },
  };
};

const request = (
  path: string,
  cookies: ReturnType<typeof jar>,
  init: RequestInit = {}
) =>
  new Request(`${BASE}${path}`, {
    ...init,
    headers: { Cookie: cookies.header(), Origin: BASE, ...init.headers },
  });

const signIn = async (auth = createAuth(options)) => {
  const cookies = jar();
  const start = await auth.handle(
    request("/api/auth/sign-in/social", cookies, {
      body: JSON.stringify({
        callbackURL: "/create",
        errorCallbackURL: "/create",
        provider: "google",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  if (!start) {
    throw new Error("Sign-in was not handled");
  }
  cookies.store(start);
  const body: { url: string } = await start.json();
  const google = new URL(body.url);
  const state = google.searchParams.get("state") ?? "";
  const callback = await auth.handle(
    request(`/api/auth/callback/google?code=code&state=${state}`, cookies)
  );
  if (!callback) {
    throw new Error("Callback was not handled");
  }
  cookies.store(callback);
  return { auth, callback, cookies, google };
};

describe("createAuth", () => {
  test("sends the browser to Google with this app's client and callback", async () => {
    const { google } = await signIn();
    expect(google.origin).toBe("https://accounts.google.com");
    expect(google.searchParams.get("client_id")).toBe("client-id");
    expect(google.searchParams.get("redirect_uri")).toBe(
      `${BASE}/api/auth/callback/google`
    );
    expect(google.searchParams.get("scope")?.split(" ")).toContain("email");
  });

  test("signs in an allowed account and returns to the requested page", async () => {
    const { auth, callback, cookies } = await signIn();
    expect(callback.status).toBe(302);
    expect(callback.headers.get("Location")).toBe("/create");
    expect(await auth.user(request("/", cookies))).toEqual({
      email: "me@example.com",
      image: "https://example.com/me.png",
      name: "Me",
    });
  });

  test("keeps the session for about a year", async () => {
    const { callback } = await signIn();
    const session = callback.headers
      .getSetCookie()
      .find((cookie) => /session_data=/u.test(cookie));
    const maxAge = Number(
      /max-age=(?<seconds>\d+)/iu.exec(session ?? "")?.groups?.seconds
    );
    expect(maxAge).toBeGreaterThanOrEqual(364 * 24 * 60 * 60);
  });

  test("survives a new server instance with the same secret", async () => {
    const { cookies } = await signIn();
    const restarted = createAuth(options);
    expect(await restarted.user(request("/", cookies))).not.toBeNull();
  });

  test("rejects accounts that are not on the list", async () => {
    profile = { ...me, email: "someone@example.com" };
    const { auth, callback, cookies } = await signIn();
    const location = new URL(callback.headers.get("Location") ?? "", BASE);
    expect(location.pathname).toBe("/create");
    expect(location.searchParams.get("error")).toBe(ACCOUNT_NOT_ALLOWED);
    expect(await auth.user(request("/", cookies))).toBeNull();
  });

  test("rejects an allowed address that Google has not verified", async () => {
    profile = { ...me, email_verified: false };
    const { auth, cookies } = await signIn();
    expect(await auth.user(request("/", cookies))).toBeNull();
  });

  test("signs out", async () => {
    const { auth, cookies } = await signIn();
    const response = await auth.handle(
      request("/api/auth/sign-out", cookies, { method: "POST" })
    );
    if (!response) {
      throw new Error("Sign-out was not handled");
    }
    cookies.store(response);
    expect(await auth.user(request("/", cookies))).toBeNull();
  });

  test("ignores a session made with a different secret", async () => {
    const { cookies } = await signIn();
    const other = createAuth({ ...options, secret: "x".repeat(40) });
    expect(await other.user(request("/", cookies))).toBeNull();
  });

  test("returns nobody without a session", async () => {
    expect(await createAuth(options).user(request("/", jar()))).toBeNull();
  });

  test("never redirects to another site after sign-in", async () => {
    const response = await createAuth(options).handle(
      request("/api/auth/sign-in/social", jar(), {
        body: JSON.stringify({
          callbackURL: "https://evil.example/steal",
          provider: "google",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );
    expect(response?.status).toBe(403);
  });

  test("leaves other requests to the app", async () => {
    const auth = createAuth(options);
    expect(await auth.handle(request("/api/pipeline/jobs", jar()))).toBe(
      undefined
    );
    expect(await auth.handle(request("/api/authors", jar()))).toBe(undefined);
  });

  test("requires a strong secret", () => {
    expect(() => createAuth({ ...options, secret: "short" })).toThrow(
      "at least 32 characters"
    );
  });
});
