import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import styles from "../styles.css?url";

const RootDocument = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {children}
      <Scripts />
    </body>
  </html>
);

const NotFound = () => (
  <main id="main-content" className="app-shell" tabIndex={-1}>
    <h1>Page not found</h1>
    <p>This page does not exist.</p>
    <Link className="text-link" to="/">
      Return home
    </Link>
  </main>
);

export const Route = createRootRoute({
  component: Outlet,
  head: () => ({
    links: [
      { href: styles, rel: "stylesheet" },
      { href: "/manifest.webmanifest", rel: "manifest" },
      { href: "/icon.svg", rel: "icon", type: "image/svg+xml" },
      { href: "/icons/apple-touch-icon.png", rel: "apple-touch-icon" },
    ],
    meta: [
      { charSet: "utf-8" },
      {
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
        name: "viewport",
      },
      { title: "Dyslexia — Article listening" },
      {
        content: "An audio-first home for articles worth listening to.",
        name: "description",
      },
      { content: "#f6f4ef", name: "theme-color" },
      { content: "yes", name: "apple-mobile-web-app-capable" },
      { content: "Dyslexia", name: "apple-mobile-web-app-title" },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});
