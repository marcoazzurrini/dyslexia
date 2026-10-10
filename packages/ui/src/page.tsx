import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { size, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: space.huge,
    justifyContent: "space-between",
    marginInline: "auto",
    maxWidth: size.measure,
    minHeight: "100dvh",
    // Focused by the skip link, not by the user, so it shows no ring.
    outlineStyle: "none",
    paddingBottom: `max(${space.xxxl}, env(safe-area-inset-bottom))`,
    paddingInline: space.gutter,
    paddingTop: `calc(env(safe-area-inset-top) + 18vh)`,
  },
});

/**
 * A full-height page without a navigation bar, such as a welcome screen:
 * its first child sits high, its last at the bottom.
 */
export const Page = ({ children }: { readonly children: ReactNode }) => (
  <main id="main-content" tabIndex={-1} {...stylex.props(styles.page)}>
    {children}
  </main>
);
