import { createAuth } from "@dyslexia/auth";
import type { Auth } from "@dyslexia/auth";

/** The Worker secrets Google sign-in needs. */
export interface AuthEnv {
  readonly AUTH_ALLOWED_EMAILS?: string;
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
}

// A Worker reuses one env object across requests, so build auth once per env.
const cache = new WeakMap<AuthEnv, Auth | undefined>();

/** Google sign-in for this app, or `undefined` until it is configured. */
export const authFor = (env: AuthEnv) => {
  if (cache.has(env)) {
    return cache.get(env);
  }
  const {
    AUTH_ALLOWED_EMAILS,
    BETTER_AUTH_SECRET,
    BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  } = env;
  const auth =
    AUTH_ALLOWED_EMAILS &&
    BETTER_AUTH_SECRET &&
    BETTER_AUTH_URL &&
    GOOGLE_CLIENT_ID &&
    GOOGLE_CLIENT_SECRET
      ? createAuth({
          allowedEmails: AUTH_ALLOWED_EMAILS.split(","),
          baseUrl: BETTER_AUTH_URL,
          google: {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
          },
          secret: BETTER_AUTH_SECRET,
        })
      : undefined;
  cache.set(env, auth);
  return auth;
};

/** Whether the request comes from an allowed, signed-in Google account. */
export const isSignedIn = async (env: AuthEnv, request: Request) =>
  Boolean(await authFor(env)?.user(request));
