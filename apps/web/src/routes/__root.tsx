import { ACCOUNT_NOT_ALLOWED } from "@dyslexia/auth/client";
import { color, font, radius, space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  ClientOnly,
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useSearch,
} from "@tanstack/react-router";
import { Schema } from "effect";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AppTabBar } from "../components/app-tab-bar";
import { NarrationsProvider } from "../components/narrations-provider";
import { stop } from "../lib/now-playing";
import { checkSession, signIn, useSession } from "../lib/session";
import { Player } from "../player/player";
import { NotFoundScreen } from "../screens/not-found-screen";
import { WelcomeScreen } from "../screens/welcome-screen";

import globalStyles from "@dyslexia/ui/global.css?url";

const styles = stylex.create({
  body: {
    backgroundColor: color.background,
    color: color.label,
    fontFamily: font.family,
  },
  // Hidden until a keyboard user focuses it.
  skip: {
    backgroundColor: color.accent,
    borderRadius: radius.full,
    color: color.onAccent,
    fontWeight: 600,
    insetBlockStart: space.sm,
    insetInlineStart: space.sm,
    paddingBlock: space.sm,
    paddingInline: space.lg,
    position: "fixed",
    textDecoration: "none",
    transform: { ":focus": "none", default: "translateY(-200%)" },
    zIndex: 100,
  },
});

// Google sign-in returns with ?error= when it does not finish.
const RootSearch = Schema.Struct({ error: Schema.optional(Schema.String) });

const RootDocument = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body {...stylex.props(styles.body)}>
      <a href="#main-content" {...stylex.props(styles.skip)}>
        Skip to content
      </a>
      {children}
      <Scripts />
    </body>
  </html>
);

/** Everything needs sign-in, so signed-out visitors see the welcome screen. */
const App = () => {
  const session = useSession();
  const { error } = useSearch({ strict: false });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void checkSession();
  }, []);

  // iPhone Safari applies :active, the press feedback of every control, only
  // while the page listens for touches.
  useEffect(() => {
    const noop = () => {
      // The listener only has to exist.
    };
    document.addEventListener("touchstart", noop, { passive: true });
    return () => {
      document.removeEventListener("touchstart", noop);
    };
  }, []);

  // Signing out forgets what was playing; other states keep it.
  useEffect(() => {
    if (session.status === "signed-out") {
      stop();
    }
  }, [session.status]);

  if (session.status !== "signed-in") {
    let signInError: "account_not_allowed" | "failed" | undefined;
    if (error === ACCOUNT_NOT_ALLOWED) {
      signInError = "account_not_allowed";
    } else if (error || failed) {
      signInError = "failed";
    }
    const start = async () => {
      setBusy(true);
      setFailed(false);
      try {
        // Success leaves the page for Google, so only failure returns here.
        await signIn();
      } catch {
        setBusy(false);
        setFailed(true);
      }
    };
    return (
      <WelcomeScreen
        session={session}
        busy={busy}
        signInError={signInError}
        onRetry={() => {
          void checkSession();
        }}
        onSignIn={() => {
          void start();
        }}
      />
    );
  }
  return (
    <NarrationsProvider>
      <Outlet />
      <AppTabBar />
      <Player />
    </NarrationsProvider>
  );
};

const dev = import.meta.env.DEV;

export const Route = createRootRoute({
  component: () => (
    <ClientOnly>
      <App />
    </ClientOnly>
  ),
  head: () => ({
    links: [
      { href: globalStyles, rel: "stylesheet" },
      // StyleX serves its CSS separately in development.
      ...(dev ? [{ href: "/virtual:stylex.css", rel: "stylesheet" }] : []),
      { href: "/manifest.webmanifest", rel: "manifest" },
      { href: "/icon.svg", rel: "icon", type: "image/svg+xml" },
      { href: "/icons/apple-touch-icon.png", rel: "apple-touch-icon" },
    ],
    meta: [
      { charSet: "utf-8" },
      {
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
        name: "viewport",
      },
      { title: "Dyslexia" },
      {
        content: "Turn articles into narrations you can listen to.",
        name: "description",
      },
      {
        content: "#f3f1ea",
        media: "(prefers-color-scheme: light)",
        name: "theme-color",
      },
      {
        content: "#0b0c0b",
        media: "(prefers-color-scheme: dark)",
        name: "theme-color",
      },
      { content: "yes", name: "mobile-web-app-capable" },
      { content: "yes", name: "apple-mobile-web-app-capable" },
      { content: "Dyslexia", name: "apple-mobile-web-app-title" },
    ],
    scripts: dev
      ? [{ src: "/@id/virtual:stylex:runtime", type: "module" }]
      : [],
  }),
  notFoundComponent: NotFoundScreen,
  shellComponent: RootDocument,
  validateSearch: Schema.toStandardSchemaV1(RootSearch),
});
