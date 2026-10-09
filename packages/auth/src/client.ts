import { createAuthClient } from "better-auth/client";

import { BASE_PATH } from "./shared.ts";

export { ACCOUNT_NOT_ALLOWED } from "./shared.ts";

const client = createAuthClient({ basePath: BASE_PATH });

/**
 * Leaves for Google sign-in, then returns to the current page. A rejected
 * account returns with `?error=` set to `ACCOUNT_NOT_ALLOWED`.
 */
export const signIn = async () => {
  // Drop an earlier sign-in error so it does not survive a later success.
  const url = new URL(location.href);
  url.searchParams.delete("error");
  const here = `${url.pathname}${url.search}`;
  const { error } = await client.signIn.social({
    callbackURL: here,
    errorCallbackURL: here,
    provider: "google",
  });
  if (error) {
    throw new Error(error.message ?? "Sign-in could not start");
  }
};

export const signOut = async () => {
  const { error } = await client.signOut();
  if (error) {
    throw new Error(error.message ?? "Sign-out failed");
  }
};

/** The signed-in Google account, or `null` when nobody is signed in. */
export const getAccount = async () => {
  const { data, error } = await client.getSession();
  if (error) {
    throw new Error(error.message ?? "Could not load the account");
  }
  return data ? { email: data.user.email, name: data.user.name } : null;
};
