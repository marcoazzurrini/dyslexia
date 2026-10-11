import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useState } from "react";

import { color, font, motion, size, space } from "./tokens.stylex.ts";

/** The element that scrolls a screen's content, and that the skip link focuses. */
const CONTENT_ID = "main-content";

const styles = stylex.create({
  accessory: { paddingBottom: space.sm },
  // Holds still above the content. A hairline appears once content
  // scrolls away beneath it.
  bar: {
    boxShadow: "0 0.5px 0 transparent",
    flexShrink: 0,
    paddingTop: "env(safe-area-inset-top)",
    transitionDuration: motion.regular,
    transitionProperty: "box-shadow",
    zIndex: 10,
  },
  barScrolled: { boxShadow: `0 0.5px 0 ${color.separator}` },
  barTitle: {
    fontSize: font.body,
    fontWeight: 600,
    lineHeight: 1.3,
    margin: 0,
    maxWidth: "60vw",
    overflow: "hidden",
    textAlign: "center",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  bottomInset: (inset: string) => ({
    paddingBottom: `calc(${space.huge} + ${inset} + env(safe-area-inset-bottom))`,
  }),
  // The width of the content, its margins clear of a phone's notch.
  column: {
    marginInline: "auto",
    maxWidth: `calc(${size.measure} + 2 * ${space.gutter})`,
    paddingInline: `max(${space.gutter}, env(safe-area-inset-left))`,
    width: "100%",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxl,
    paddingTop: space.md,
  },
  inline: {
    alignItems: "center",
    display: "grid",
    gap: space.sm,
    gridTemplateColumns: "1fr auto 1fr",
    minHeight: size.navBar,
    paddingInline: `max(${space.lg}, env(safe-area-inset-left))`,
  },
  // The large title shares its row with the screen's actions.
  large: {
    alignItems: "center",
    display: "flex",
    gap: space.sm,
    minHeight: size.navBar,
    paddingBlock: space.xs,
  },
  largeTitle: {
    flexGrow: 1,
    fontSize: font.largeTitle,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
    minWidth: 0,
    paddingInline: space.xs,
    textWrap: "balance",
  },
  // Plain content, such as narrations, sits on the canvas, not the grouped
  // gray.
  plain: { backgroundColor: color.canvas },
  screen: {
    backgroundColor: color.background,
    color: color.label,
    display: "flex",
    flexDirection: "column",
    fontFamily: font.family,
    height: "100dvh",
    overflow: "hidden",
  },
  // Only the content scrolls, and its bounce stays inside it.
  scroller: {
    flexGrow: 1,
    minHeight: 0,
    outlineStyle: "none",
    overflowY: "auto",
    overscrollBehaviorY: "contain",
  },
  side: { alignItems: "center", display: "flex", gap: space.sm, minWidth: 0 },
  trailing: { justifyContent: "flex-end" },
});

/** Scrolls the open screen back to its top, as pressing the open tab does in iOS. */
export const scrollScreenToTop = () => {
  document
    .querySelector(`#${CONTENT_ID}`)
    ?.scrollTo({ behavior: "smooth", top: 0 });
};

export interface ScreenProps {
  readonly title: string;
  /**
   * `large` shows a large title beside the actions, for top level screens.
   * `inline` centers a small title in a navigation bar, for detail screens.
   */
  readonly titleDisplay?: "large" | "inline";
  /** Before the title, such as a back button. */
  readonly leading?: ReactNode;
  /** After the title, such as an add button. */
  readonly trailing?: ReactNode;
  /** Under the title, holding still with it, such as filters. */
  readonly accessory?: ReactNode;
  readonly children: ReactNode;
  /** Space kept clear at the bottom, such as for a floating player. */
  readonly bottomInset?: string;
  /**
   * `plain` sets content on the canvas, for media such as narrations;
   * `grouped` sets it on gray, for settings in grouped lists.
   */
  readonly background?: "grouped" | "plain";
}

/**
 * A full screen whose title stays put while only its content scrolls, as
 * in a native app.
 */
export const Screen = ({
  accessory,
  background = "grouped",
  bottomInset = "0px",
  children,
  leading,
  title,
  titleDisplay = "large",
  trailing,
}: ScreenProps) => {
  const [scrolled, setScrolled] = useState(false);
  return (
    <div
      {...stylex.props(styles.screen, background === "plain" && styles.plain)}
    >
      <header {...stylex.props(styles.bar, scrolled && styles.barScrolled)}>
        {titleDisplay === "large" ? (
          <div {...stylex.props(styles.column, styles.large)}>
            {leading}
            <h1 {...stylex.props(styles.largeTitle)}>{title}</h1>
            {trailing}
          </div>
        ) : (
          <div {...stylex.props(styles.column, styles.inline)}>
            <div {...stylex.props(styles.side)}>{leading}</div>
            <h1 {...stylex.props(styles.barTitle)}>{title}</h1>
            <div {...stylex.props(styles.side, styles.trailing)}>
              {trailing}
            </div>
          </div>
        )}
        {accessory && (
          <div {...stylex.props(styles.column, styles.accessory)}>
            {accessory}
          </div>
        )}
      </header>
      <main
        id={CONTENT_ID}
        tabIndex={-1}
        // The router restores where each screen was scrolled to.
        data-scroll-restoration-id="screen"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
        {...stylex.props(styles.scroller)}
      >
        <div
          {...stylex.props(
            styles.column,
            styles.content,
            styles.bottomInset(bottomInset)
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
};
