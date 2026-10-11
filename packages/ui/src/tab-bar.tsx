import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

import { recipes } from "./recipes.ts";
import { color, media, motion, size, space } from "./tokens.stylex.ts";

/** How far the tray tucks under the bar. */
const TUCK = space.xl;

// The tray slides up from behind the bar, clipped where it leaves it.
const slideOut = stylex.keyframes({
  from: { clipPath: "inset(0 0 100% 0)", transform: "translateY(100%)" },
  to: { clipPath: "inset(0)", transform: "none" },
});

const styles = stylex.create({
  // A tray tucked behind the bar's top edge, lit along its own top.
  accessory: {
    animationDuration: motion.slow,
    animationName: { default: slideOut, [media.reducedMotion]: "none" },
    animationTimingFunction: motion.spring,
    backgroundColor: color.tray,
    borderRadius: TUCK,
    boxShadow: `inset 0 0.5px 0 ${color.glassEdge}, 0 8px 30px rgb(0 0 0 / 0.16)`,
    // Hidden while it holds nothing, so it slides out when filled.
    display: { ":empty": "none", default: "block" },
    marginBlockEnd: `calc(-1 * ${TUCK})`,
    marginInline: "auto",
    maxWidth: size.dock,
    paddingBlockEnd: TUCK,
    pointerEvents: "auto",
  },
  // Keeps the tray off the screen's sides.
  accessoryRow: {
    paddingInline: `max(${space.sm}, env(safe-area-inset-left))`,
  },
  // A circle at the bar's end.
  action: {
    alignItems: "center",
    backgroundColor: { ":active": color.fillPressed, default: color.fill },
    borderRadius: "50%",
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexShrink: 0,
    fontSize: "1.2rem",
    height: size.touch,
    justifyContent: "center",
    marginInlineEnd: space.sm,
    padding: 0,
    width: size.touch,
  },
  // Docked to the bottom edge, under the home indicator. Content fades out
  // above it, so no row shows half cut beside the mini player.
  dock: {
    "::before": {
      backgroundImage: `linear-gradient(to top, ${color.canvas} 50%, transparent)`,
      bottom: 0,
      content: "''",
      height: `calc(100% + ${space.xl})`,
      insetInline: 0,
      position: "absolute",
      zIndex: -1,
    },
    bottom: 0,
    paddingInline: 0,
    zIndex: 21,
  },
  icon: { display: "flex", fontSize: "1.4rem" },
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
    position: "relative",
    textDecoration: "none",
    userSelect: "none",
  },
  items: { display: "flex", flexGrow: 1, height: "100%" },
  // The tabs, as wide as screen content, centered in the bar.
  row: {
    alignItems: "center",
    display: "flex",
    height: size.tabBar,
    marginInline: "auto",
    maxWidth: size.dock,
  },
  selected: { color: color.accentText },
  // Edge to edge, with a hairline along its top, as iOS's tab bar.
  surface: {
    backgroundColor: {
      default: color.glass,
      [media.reducedTransparency]: color.elevated,
    },
    boxShadow: `inset 0 0.5px 0 ${color.separator}`,
    paddingBlockEnd: "env(safe-area-inset-bottom)",
    paddingInlineEnd: "env(safe-area-inset-right)",
    paddingInlineStart: "env(safe-area-inset-left)",
    pointerEvents: "auto",
    // Above the tray, which tucks under it.
    position: "relative",
  },
});

export interface TabBarProps {
  /** The accessible name of the navigation, such as "Main". */
  readonly label: string;
  /** One keyed `TabBarLink` per tab, in order. */
  readonly tabs: readonly ReactNode[];
  /**
   * A tray that slides out from behind the bar, such as the mini player.
   * It stays tucked away while it renders nothing.
   */
  readonly accessory?: ReactNode;
  /** A `TabBarAction` at the bar's end, for what can be done anywhere. */
  readonly action?: ReactNode;
}

/**
 * The floating bar of top-level destinations at the bottom of the screen,
 * as in iOS. The selected tab takes the tint; no shape sits behind it.
 */
export const TabBar = ({ accessory, action, label, tabs }: TabBarProps) => (
  <nav aria-label={label} {...stylex.props(recipes.bottomDock, styles.dock)}>
    <div {...stylex.props(styles.accessoryRow)}>
      <div {...stylex.props(styles.accessory)}>{accessory}</div>
    </div>
    <div {...stylex.props(styles.surface)}>
      <div {...stylex.props(styles.row)}>
        <div {...stylex.props(styles.items)}>{tabs}</div>
        {action}
      </div>
    </div>
  </nav>
);

export interface TabBarActionProps extends Omit<
  ComponentProps<"button">,
  "className" | "style" | "children" | "type"
> {
  readonly icon: ReactNode;
  /** The accessible name, such as "Add article". */
  readonly label: string;
}

/** The one action in the tab bar, such as adding something new. */
export const TabBarAction = ({ icon, label, ...props }: TabBarActionProps) => (
  <button
    type="button"
    aria-label={label}
    {...props}
    {...stylex.props(recipes.focusRing, recipes.press, styles.action)}
  >
    {icon}
  </button>
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
    {...stylex.props(
      recipes.focusRingInset,
      recipes.press,
      styles.item,
      selected && styles.selected
    )}
  >
    <span {...stylex.props(styles.icon)}>{icon}</span>
    {label}
  </a>
);
