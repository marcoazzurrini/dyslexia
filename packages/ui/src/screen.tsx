import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { color, font, media, motion, size, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  // Cancels the gap, so the sentinel sits right under the title.
  afterTitle: { marginTop: `calc(-1 * ${space.xxl})` },
  bar: {
    backdropFilter: "none",
    backgroundColor: "transparent",
    insetBlockStart: 0,
    paddingTop: "env(safe-area-inset-top)",
    position: "sticky",
    transitionDuration: motion.regular,
    transitionProperty: "background-color, box-shadow, backdrop-filter",
    zIndex: 10,
  },
  barContent: {
    alignItems: "center",
    display: "grid",
    gap: space.sm,
    gridTemplateColumns: "1fr auto 1fr",
    marginInline: "auto",
    maxWidth: `calc(${size.measure} + 2 * ${space.gutter})`,
    minHeight: size.navBar,
    paddingInline: `max(${space.lg}, env(safe-area-inset-left))`,
  },
  barScrolled: {
    backdropFilter: {
      default: "blur(20px) saturate(180%)",
      [media.reducedTransparency]: "none",
    },
    backgroundColor: {
      default: color.glass,
      [media.reducedTransparency]: color.background,
    },
    boxShadow: `0 0.5px 0 ${color.separator}`,
  },
  barTitle: {
    fontSize: font.body,
    fontWeight: 600,
    lineHeight: 1.3,
    margin: 0,
    maxWidth: "60vw",
    overflow: "hidden",
    textAlign: "center",
    textOverflow: "ellipsis",
    transitionDuration: motion.regular,
    transitionProperty: "opacity, transform",
    whiteSpace: "nowrap",
  },
  barTitleHidden: { opacity: 0, transform: "translateY(4px)" },
  bottomInset: (inset: string) => ({
    paddingBottom: `calc(${space.huge} + ${inset} + env(safe-area-inset-bottom))`,
  }),
  largeTitle: {
    fontSize: font.largeTitle,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
    marginBottom: `calc(-1 * ${space.sm})`,
    paddingInline: space.xs,
    textWrap: "balance",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxl,
    marginInline: "auto",
    maxWidth: `calc(${size.measure} + 2 * ${space.gutter})`,
    outlineStyle: "none",
    paddingInline: `max(${space.gutter}, env(safe-area-inset-left))`,
  },
  // Plain content, such as narrations, sits on the canvas, not the grouped
  // gray.
  plain: { backgroundColor: color.canvas },
  screen: {
    backgroundColor: color.background,
    color: color.label,
    fontFamily: font.family,
    minHeight: "100dvh",
  },
  sentinel: { height: 0 },
  side: { alignItems: "center", display: "flex", gap: space.sm, minWidth: 0 },
  trailing: { justifyContent: "flex-end" },
});

export interface ScreenProps {
  readonly title: string;
  /**
   * `large` shows a large title that moves into the bar on scroll, for top
   * level screens. `inline` keeps a small title in the bar, for detail screens.
   */
  readonly titleDisplay?: "large" | "inline";
  /** Left of the bar, such as a back button. */
  readonly leading?: ReactNode;
  /** Right of the bar, such as an add button. */
  readonly trailing?: ReactNode;
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
 * A full screen with an iOS navigation bar. The bar is transparent until
 * content scrolls under it, then becomes a translucent material.
 */
export const Screen = ({
  background = "grouped",
  bottomInset = "0px",
  children,
  leading,
  title,
  titleDisplay = "large",
  trailing,
}: ScreenProps) => {
  const bar = useRef<HTMLElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // The sentinel follows the large title, or the top of the content.
    // Content is scrolled once it passes under the bar.
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (bar.current && sentinel.current) {
        setScrolled(
          sentinel.current.getBoundingClientRect().top <
            bar.current.getBoundingClientRect().bottom
        );
      }
    };
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const large = titleDisplay === "large";
  return (
    <div
      {...stylex.props(styles.screen, background === "plain" && styles.plain)}
    >
      <header
        ref={bar}
        {...stylex.props(styles.bar, scrolled && styles.barScrolled)}
      >
        <div {...stylex.props(styles.barContent)}>
          <div {...stylex.props(styles.side)}>{leading}</div>
          {large ? (
            <p
              aria-hidden="true"
              {...stylex.props(
                styles.barTitle,
                !scrolled && styles.barTitleHidden
              )}
            >
              {title}
            </p>
          ) : (
            <h1 {...stylex.props(styles.barTitle)}>{title}</h1>
          )}
          <div {...stylex.props(styles.side, styles.trailing)}>{trailing}</div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        {...stylex.props(styles.main, styles.bottomInset(bottomInset))}
      >
        {large && <h1 {...stylex.props(styles.largeTitle)}>{title}</h1>}
        <div
          ref={sentinel}
          {...stylex.props(styles.sentinel, large && styles.afterTitle)}
        />
        {children}
      </main>
    </div>
  );
};
