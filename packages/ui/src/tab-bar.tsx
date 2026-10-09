import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

import { color, media, motion, radius, size, space } from "./tokens.stylex.ts";

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
    boxShadow: `inset 0 0.5px 0 ${color.glassEdge}, 0 10px 30px rgb(0 0 0 / 0.14), 0 1px 3px rgb(0 0 0 / 0.08)`,
    marginInline: "auto",
    maxWidth: size.dock,
    pointerEvents: "auto",
  },
  // Floats above the content and the home indicator. Content fades out
  // behind it, so no row shows half cut beside the bar.
  dock: {
    "::before": {
      backgroundImage: `linear-gradient(to top, ${color.canvas} 50%, transparent)`,
      bottom: `calc(-1 * max(${space.sm}, env(safe-area-inset-bottom)))`,
      content: "''",
      height: `calc(100% + max(${space.sm}, env(safe-area-inset-bottom)) + ${space.xl})`,
      insetInline: 0,
      position: "absolute",
      zIndex: -1,
    },
    bottom: `max(${space.sm}, env(safe-area-inset-bottom))`,
    insetInline: 0,
    paddingInline: `max(${space.lg}, env(safe-area-inset-left))`,
    pointerEvents: "none",
    position: "fixed",
    // Above the mini player, whose fade must never cover the tabs.
    zIndex: 21,
  },
  icon: { display: "flex", fontSize: "1.5rem" },
  item: {
    // Long-press opens no link preview, as with native tabs.
    WebkitTouchCallout: "none",
    alignItems: "center",
    color: color.secondaryLabel,
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
  items: { display: "flex", height: size.tabBar },
  selected: { color: color.accentText },
});

export interface TabBarProps {
  /** The accessible name of the navigation, such as "Main". */
  readonly label: string;
  /** One keyed `TabBarLink` per tab, in order. */
  readonly tabs: readonly ReactNode[];
}

/**
 * The floating bar of top-level destinations at the bottom of the screen,
 * as in iOS. The selected tab takes the tint; no shape sits behind it.
 */
export const TabBar = ({ label, tabs }: TabBarProps) => (
  <nav aria-label={label} {...stylex.props(styles.dock)}>
    <div {...stylex.props(styles.bar)}>
      <div {...stylex.props(styles.items)}>{tabs}</div>
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
