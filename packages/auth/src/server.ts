import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";

import { ACCOUNT_NOT_ALLOWED, BASE_PATH } from "./shared.ts";
import type { User } from "./shared.ts";

export { ACCOUNT_NOT_ALLOWED } from "./shared.ts";
export type { User } from "./shared.ts";

export interface AuthOptions {
  /** Public origin of the app, such as `https://example.com`. */
  readonly baseUrl: string;
  /** At least 32 random characters. Signs and encrypts session cookies. */
  readonly secret: string;
  readonly google: { readonly clientId: string; readonly clientSecret: string };
  /** The only Google accounts allowed to sign in. Case does not matter. */
  readonly allowedEmails: readonly string[];
}

export interface Auth {
  /**
   * Serves sign-in, sign-out, and session requests from the client.
   * Returns `undefined` for requests that are not for authentication.
   */
  handle: (request: Request) => Promise<Response | undefined>;
  /** The signed-in user, or `null` when nobody allowed is signed in. */
  user: (request: Request) => Promise<User | null>;
}

// Signing in again is rare; each use extends the session.
const SESSION_SECONDS = 365 * 24 * 60 * 60;

/**
 * Google sign-in for a fixed list of accounts, with no database: the
 * session lives in an encrypted cookie.
 */
export const createAuth = (options: AuthOptions): Auth => {
  if (options.secret.length < 32) {
    throw new Error("The auth secret must be at least 32 characters");
  }
  const allowed = new Set(
    options.allowedEmails.map((email) => email.trim().toLowerCase())
  );
  const isAllowed = (email: string, verified: boolean) =>
    verified && allowed.has(email.toLowerCase());

  const auth = betterAuth({
    advanced: {
      // Better Auth skips redirect checks under test runners unless set.
      disableOriginCheck: false,
      useSecureCookies: options.baseUrl.startsWith("https:"),
    },
    basePath: BASE_PATH,
    baseURL: options.baseUrl,
    // Without a database, every sign-in creates the user again, so this
    // check runs on every sign-in.
    databaseHooks: {
      user: {
        create: {
          before: (user) => {
            if (!isAllowed(user.email, user.emailVerified)) {
              // A code makes the callback redirect with ?error= instead
              // of returning a bare error page.
              throw new APIError("FORBIDDEN", {
                code: ACCOUNT_NOT_ALLOWED,
                message: "This Google account is not allowed",
              });
            }
            return Promise.resolve();
          },
        },
      },
    },
    // Failed sign-ins return to the app rather than Better Auth's error page.
    onAPIError: { errorURL: "/" },
    secret: options.secret,
    session: { expiresIn: SESSION_SECONDS },
    socialProviders: {
      google: {
        clientId: options.google.clientId,
        clientSecret: options.google.clientSecret,
        prompt: "select_account",
      },
    },
    telemetry: { enabled: false },
    trustedOrigins: [options.baseUrl],
  });

  return {
    async handle(request) {
      const { pathname } = new URL(request.url);
      if (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`)) {
        return await auth.handler(request);
      }
    },
    async user(request) {
      const session = await auth.api
        .getSession({ headers: request.headers })
        .catch(() => null);
      if (
        !session ||
        !isAllowed(session.user.email, session.user.emailVerified)
      ) {
        return null;
      }
      return {
        email: session.user.email,
        image: session.user.image ?? null,
        name: session.user.name,
      };
    },
  };
};
