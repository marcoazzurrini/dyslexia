import {
  signIn as googleSignIn,
  signOut as googleSignOut,
} from "@dyslexia/auth/client";
import { useSyncExternalStore } from "react";

import type { PipelineSession } from "../pipeline/contracts";
import { fetchSession, PipelineError } from "./pipeline-client";

export type SessionState =
  | { readonly status: "checking" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "unconfigured" }
  | {
      readonly status: "signed-out";
      /** The session ended while the app was open. */
      readonly expired?: boolean;
    }
  | { readonly status: "signed-in" };

let state: SessionState = { status: "checking" };
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

const set = (next: SessionState) => {
  state = next;
  for (const listener of listeners) {
    listener();
  }
};

const fromSession = ({
  authenticated,
  configured,
}: PipelineSession): SessionState => {
  if (!configured) {
    return { status: "unconfigured" };
  }
  return authenticated ? { status: "signed-in" } : { status: "signed-out" };
};

/** Asks the server who is signed in. Safe to call repeatedly. */
export const checkSession = async () => {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  try {
    const session = await fetchSession(current.signal);
    if (!current.signal.aborted) {
      set(fromSession(session));
    }
  } catch (error) {
    if (!current.signal.aborted) {
      set({
        message:
          error instanceof Error ? error.message : "Could not check access.",
        status: "error",
      });
    }
  }
};

/**
 * Signs the person out everywhere when a request finds the session expired,
 * so private data leaves the screen. Returns whether it did.
 */
export const expireIfUnauthorized = (error: Error) => {
  if (error instanceof PipelineError && error.status === 401) {
    set({ expired: true, status: "signed-out" });
    return true;
  }
  return false;
};

/** Leaves the app for Google and returns to the current page. */
export const signIn = () => googleSignIn();

export const signOut = async () => {
  await googleSignOut();
  set({ status: "signed-out" });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const SERVER: SessionState = { status: "checking" };

export const useSession = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER
  );
