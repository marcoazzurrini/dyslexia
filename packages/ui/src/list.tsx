import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

import { ChevronRightIcon } from "./icons.tsx";
import { useSwipe } from "./swipe.ts";
import type { SwipeAction } from "./swipe.ts";
import { color, font, media, radius, size, space } from "./tokens.stylex.ts";

/** How far a row slides to reveal its swipe action, in pixels. */
const ACTION_WIDTH = 88;

/**
 * Plain lists sit straight on the canvas, as in Podcasts, so their rows take
 * the canvas color instead of the grouped cell color.
 */
const plainTheme = stylex.createTheme(color, {
  surface: {
    "@media (prefers-color-scheme: dark)": "#0d0d0f",
    default: "#f7f7f9",
  },
});

const styles = stylex.create({
  accessory: {
    color: color.tertiaryLabel,
    display: "flex",
    flexShrink: 0,
  },
  // Fills the row behind it, so an overswipe shows red, not a gap.
  action: {
    alignItems: "stretch",
    backgroundColor: color.destructive,
    borderStyle: "none",
    color: color.onAccent,
    cursor: "pointer",
    display: "flex",
    fontFamily: font.family,
    fontSize: font.body,
    fontWeight: 600,
    inset: 0,
    justifyContent: "flex-end",
    padding: 0,
    position: "absolute",
    // Shown by the swipe while the row moves.
    visibility: "hidden",
  },
  actionLabel: {
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    width: `${ACTION_WIDTH}px`,
  },
  detail: {
    color: color.secondaryLabel,
    flexShrink: 0,
    fontSize: font.subheadline,
    textAlign: "end",
  },
  disabled: { cursor: "not-allowed", opacity: 0.5 },
  draggable: {
    // The row owns horizontal drags; the page keeps vertical scrolling.
    touchAction: "pan-y",
    userSelect: "none",
  },
  footer: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    lineHeight: 1.4,
    paddingInline: space.lg,
  },
  // Slides over the swipe action, carrying the row's controls.
  foreground: {
    alignItems: "center",
    backgroundColor: color.surface,
    display: "flex",
    flexGrow: 1,
    minWidth: 0,
    position: "relative",
  },
  header: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    fontWeight: 600,
    lineHeight: 1.35,
    paddingInline: space.lg,
  },
  // A bold heading, as content apps such as Podcasts head their sections.
  headerProminent: {
    color: color.label,
    fontSize: font.title3,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    paddingInline: space.xxs,
  },
  // Leading artwork is 3.5rem wide, followed by the row gap.
  iconInset: {
    backgroundImage: `linear-gradient(to right, ${color.surface} calc(${space.lg} + 3.5rem + ${space.md}), ${color.separator} calc(${space.lg} + 3.5rem + ${space.md}))`,
  },
  item: {
    backgroundColor: color.surface,
    display: "flex",
    overflow: "hidden",
    position: "relative",
  },
  leading: {
    color: color.accentText,
    display: "flex",
    flexShrink: 0,
  },
  // Separators are the gaps between rows. The gradient leaves the first
  // part of each gap in the cell color, so separators start at the text.
  list: {
    backgroundColor: color.surface,
    backgroundImage: `linear-gradient(to right, ${color.surface} ${space.lg}, ${color.separator} ${space.lg})`,
    borderRadius: radius.lg,
    display: "grid",
    gap: { [media.hiDpi]: "0.5px", default: "1px" },
    overflow: "hidden",
  },
  // No card: rows sit on the canvas, their text aligned to the screen's
  // margin.
  plainList: {
    borderRadius: 0,
    marginInline: `calc(${space.lg} - ${space.gutter})`,
  },
  pressable: {
    backgroundColor: {
      ":active": color.surfacePressed,
      ":hover": { [media.hover]: color.surfacePressed, default: null },
      default: "transparent",
    },
    outlineColor: color.focus,
    outlineOffset: "-3px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
    touchAction: "manipulation",
    transitionDuration: "150ms",
    transitionProperty: "background-color",
  },
  row: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexGrow: 1,
    fontFamily: font.family,
    fontSize: font.body,
    gap: space.md,
    minHeight: size.touch,
    minWidth: 0,
    paddingBlock: space.md,
    paddingInline: space.lg,
    textAlign: "start",
    textDecoration: "none",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
  },
  subtitle: {
    color: color.secondaryLabel,
    fontSize: font.subheadline,
    lineHeight: 1.35,
  },
  text: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: space.xxs,
    minWidth: 0,
  },
  title: {
    fontWeight: 500,
    lineHeight: 1.35,
  },
  trailing: {
    display: "flex",
    flexShrink: 0,
    paddingInlineEnd: space.sm,
  },
});

const CHEVRON = <ChevronRightIcon />;

export interface ListSectionProps {
  readonly children: ReactNode;
  /** A short heading above the section. */
  readonly header?: ReactNode;
  /** Help text below the section. */
  readonly footer?: ReactNode;
  /** Rows start with 3.5rem artwork, so separators start after it. */
  readonly withIcons?: boolean;
  /** A bold header, for sections of content rather than settings. */
  readonly prominent?: boolean;
  /** Rows sit on the canvas, edge to edge, instead of in a card. */
  readonly plain?: boolean;
  readonly style?: StyleXStyles;
}

/** An inset grouped list section, as in iOS Settings. Holds list rows. */
export const ListSection = ({
  children,
  footer,
  header,
  plain = false,
  prominent = false,
  style,
  withIcons = false,
}: ListSectionProps) => (
  <section {...stylex.props(styles.section, style)}>
    {header && (
      <h2 {...stylex.props(styles.header, prominent && styles.headerProminent)}>
        {header}
      </h2>
    )}
    <ul
      {...stylex.props(
        plain && plainTheme,
        styles.list,
        withIcons && styles.iconInset,
        plain && styles.plainList
      )}
    >
      {children}
    </ul>
    {footer && <div {...stylex.props(styles.footer)}>{footer}</div>}
  </section>
);

interface RowContent {
  readonly title: ReactNode;
  /** A second line under the title. */
  readonly subtitle?: ReactNode;
  /** Before the text, such as an icon or artwork. */
  readonly leading?: ReactNode;
  /** Trailing text, such as a status. */
  readonly detail?: ReactNode;
  /** After the detail. Pressable rows show a chevron by default. */
  readonly accessory?: ReactNode;
}

const Content = ({
  accessory,
  detail,
  leading,
  subtitle,
  title,
}: RowContent) => (
  <>
    {leading && <span {...stylex.props(styles.leading)}>{leading}</span>}
    <span {...stylex.props(styles.text)}>
      <span {...stylex.props(styles.title)}>{title}</span>
      {subtitle && <span {...stylex.props(styles.subtitle)}>{subtitle}</span>}
    </span>
    {detail && <span {...stylex.props(styles.detail)}>{detail}</span>}
    {accessory && <span {...stylex.props(styles.accessory)}>{accessory}</span>}
  </>
);

export type ListRowProps = RowContent;

/** A row that shows information and does nothing when pressed. */
export const ListRow = (props: ListRowProps) => (
  <li {...stylex.props(styles.item)}>
    <div {...stylex.props(styles.row)}>
      <Content {...props} />
    </div>
  </li>
);

export interface ListButtonProps
  extends
    RowContent,
    Omit<ComponentProps<"button">, "className" | "style" | "title"> {
  /**
   * Revealed by swiping the row left, as iOS reveals Delete. A swipe is easy
   * to miss and needs a finger, so also offer the action through a visible
   * control, such as a `trailing` more button.
   */
  readonly swipeAction?: SwipeAction;
  /** A control after the row's own button, such as a more button. */
  readonly trailing?: ReactNode;
}

/** A row that performs an action. */
export const ListButton = ({
  accessory,
  detail,
  leading,
  subtitle,
  swipeAction,
  title,
  trailing,
  type = "button",
  ...props
}: ListButtonProps) => {
  const { close, handlers, rowRef } = useSwipe(
    swipeAction !== undefined,
    ACTION_WIDTH
  );
  return (
    <li {...stylex.props(styles.item)}>
      {swipeAction && (
        // Hidden from assistive technology and the keyboard: the visible
        // control offers the same action to them.
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => {
            close();
            swipeAction.onAction();
          }}
          {...stylex.props(styles.action)}
        >
          <span {...stylex.props(styles.actionLabel)}>{swipeAction.label}</span>
        </button>
      )}
      <div
        ref={rowRef}
        {...handlers}
        {...stylex.props(styles.foreground, swipeAction && styles.draggable)}
      >
        <button
          type={type === "submit" ? "submit" : "button"}
          {...props}
          {...stylex.props(
            styles.row,
            styles.pressable,
            props.disabled && styles.disabled
          )}
        >
          <Content
            accessory={accessory}
            detail={detail}
            leading={leading}
            subtitle={subtitle}
            title={title}
          />
        </button>
        {trailing && <span {...stylex.props(styles.trailing)}>{trailing}</span>}
      </div>
    </li>
  );
};

export interface ListLinkProps
  extends
    RowContent,
    Omit<ComponentProps<"a">, "className" | "style" | "title"> {}

/**
 * A row that navigates. Wrap it with the router's link factory to make it a
 * router link.
 */
export const ListLink = ({
  accessory = CHEVRON,
  detail,
  leading,
  subtitle,
  title,
  ...props
}: ListLinkProps) => (
  <li {...stylex.props(styles.item)}>
    <a {...props} {...stylex.props(styles.row, styles.pressable)}>
      <Content
        accessory={accessory}
        detail={detail}
        leading={leading}
        subtitle={subtitle}
        title={title}
      />
    </a>
  </li>
);
