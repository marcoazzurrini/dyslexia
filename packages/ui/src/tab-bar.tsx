import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

import { color, media, motion, radius, size, space } from "./tokens.stylex.ts";

// The bar's inner padding, which the selection pill keeps inside.
const PADDING = "4px";

const styles = stylex.create({
  bar: {
    backdropFilter: {
      default: "blur(24px) saturate(180%)",
      [media.reducedTransparency]: "none",
    },
    backgroundColor: {
      default: color.glass,
      [media.reducedTransparency]: color.elevated,
    },
    borderRadius: radius.full,
    boxShadow: `inset 0 0.5px 0 ${color.glassEdge}, 0 8px 30px rgb(0 0 0 / 0.16)`,
    display: "flex",
    height: size.tabBar,
    marginInline: "auto",
    maxWidth: size.dock,
    padding: PADDING,
    pointerEvents: "auto",
    position: "relative",
  },
  dock: {
    bottom: `max(${space.sm}, env(safe-area-inset-bottom))`,
    insetInline: 0,
    paddingInline: `max(${space.md}, env(safe-area-inset-left))`,
    pointerEvents: "none",
    position: "fixed",
    zIndex: 20,
  },
  icon: { display: "flex", fontSize: "1.4rem" },
  // Slides to the selected tab, so the eye follows the change.
  indicator: (count: number, index: number) => ({
    transform: `translateX(${index * 100}%)`,
    width: `calc((100% - 2 * ${PADDING}) / ${count})`,
  }),
  item: {
    // Long-press opens no link preview, as with native tabs.
    WebkitTouchCallout: "none",
    alignItems: "center",
    borderRadius: radius.full,
    color: color.label,
    display: "flex",
    flexBasis: 0,
    flexDirection: "column",
    flexGrow: 1,
    // Tab labels stay small and fixed, as in iOS, so the bar keeps its height.
    fontSize: "11px",
    fontWeight: 600,
    gap: "1px",
    justifyContent: "center",
    lineHeight: 1.2,
    minWidth: 0,
    outlineColor: color.focus,
    outlineOffset: "-2px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
    position: "relative",
    textDecoration: "none",
    touchAction: "manipulation",
    transform: {
      ":active": { default: "scale(0.94)", [media.reducedMotion]: "none" },
      default: "none",
    },
    transitionDuration: motion.fast,
    transitionProperty: "color, transform",
    transitionTimingFunction: motion.easeOut,
    userSelect: "none",
  },
  pill: {
    backgroundColor: color.fill,
    borderRadius: radius.full,
    insetBlock: PADDING,
    insetInlineStart: PADDING,
    position: "absolute",
    transitionDuration: { default: motion.slow, [media.reducedMotion]: "0s" },
    transitionProperty: "transform",
    transitionTimingFunction: motion.spring,
  },
  selected: { color: color.accentText },
});

export interface TabBarProps {
  /** The accessible name of the navigation, such as "Main". */
  readonly label: string;
  /** The position of the selected tab, or -1 when none is selected. */
  readonly selected: number;
  /** One keyed `TabBarLink` per tab, in order. */
  readonly tabs: readonly ReactNode[];
}

/**
 * The floating bar of top-level destinations at the bottom of the screen,
 * as in iOS. A pill marks the selected tab and slides when it changes.
 */
export const TabBar = ({ label, selected, tabs }: TabBarProps) => (
  <nav aria-label={label} {...stylex.props(styles.dock)}>
    <div {...stylex.props(styles.bar)}>
      {selected !== -1 && (
        <span
          aria-hidden="true"
          {...stylex.props(
            styles.pill,
            styles.indicator(tabs.length, selected)
          )}
        />
      )}
      {tabs}
    </div>
  </nav>
);

export interface TabBarLinkProps extends Omit<
  ComponentProps<"a">,
  "className" | "style" | "children"
> {
  readonly icon: ReactNode;
  readonly label: string;
  /** This tab's destination is on screen. */
  readonly selected?: boolean;
}

/**
 * One tab. Wrap it with the router's link factory to make it a router link.
 */
export const TabBarLink = ({
  icon,
  label,
  selected = false,
  ...props
}: TabBarLinkProps) => (
  <a
    aria-current={selected ? "page" : undefined}
    {...props}
    {...stylex.props(styles.item, selected && styles.selected)}
  >
    <span {...stylex.props(styles.icon)}>{icon}</span>
    {label}
  </a>
);
