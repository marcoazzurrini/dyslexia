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
  // A circle concentric with the bar's end.
  action: {
    alignItems: "center",
    backgroundColor: { ":active": color.fillPressed, default: color.fill },
    borderRadius: "50%",
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexShrink: 0,
    fontSize: "1.1rem",
    height: `calc(${size.tabBar} - 2 * ${space.xs} - 2px)`,
    justifyContent: "center",
    marginInlineEnd: `calc(${space.xs} + 1px)`,
    padding: 0,
    width: `calc(${size.tabBar} - 2 * ${space.xs} - 2px)`,
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
    // Closer to the screen's sides than other docked bars.
    paddingInline: `max(calc(${space.xs} + ${space.xxs}), env(safe-area-inset-left))`,
    zIndex: 21,
  },
  icon: { display: "flex", fontSize: "1.3rem" },
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
    fontSize: "10px",
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
  row: { marginInline: "auto", maxWidth: size.dock },
  selected: { color: color.accentText },
  // Above the tray, which tucks under it.
  surface: { alignItems: "center", display: "flex", position: "relative" },
  tray: {
    animationDuration: motion.slow,
    animationName: { default: slideOut, [media.reducedMotion]: "none" },
    animationTimingFunction: motion.spring,
    backgroundColor: color.tray,
    borderColor: color.separator,
    borderRadius: TUCK,
    borderStyle: "solid",
    borderWidth: "0.5px",
    // Hidden while it holds nothing, so it slides out when filled.
    display: { ":empty": "none", default: "block" },
    marginBlockEnd: `calc(-1 * ${TUCK})`,
    marginInline: space.xxl,
    paddingBlockEnd: TUCK,
    pointerEvents: "auto",
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
    <div {...stylex.props(styles.row)}>
      <div {...stylex.props(styles.tray)}>{accessory}</div>
      <div {...stylex.props(recipes.bottomBar, styles.surface)}>
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
