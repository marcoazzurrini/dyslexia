import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext } from "react";

import { IconButton } from "./icon-button.tsx";
import { CheckIcon, ChevronRightIcon, EllipsisIcon } from "./icons.tsx";
import { recipes } from "./recipes.ts";
import { Section } from "./section.tsx";
import { useSwipe } from "./swipe.ts";
import type { SwipeAction } from "./swipe.ts";
import { color, font, media, radius, size, space } from "./tokens.stylex.ts";

/** How far a row slides to reveal its swipe action, in pixels. */
const ACTION_WIDTH = 88;

/**
 * Media lists sit straight on the canvas, as in Podcasts, so their rows take
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
  destructive: { color: color.danger },
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
  // margin. Separators start after the 3.5rem artwork.
  mediaList: {
    backgroundImage: `linear-gradient(to right, ${color.surface} calc(${space.lg} + 3.5rem + ${space.md}), ${color.separator} calc(${space.lg} + 3.5rem + ${space.md}))`,
    borderRadius: 0,
    marginInline: `calc(${space.lg} - ${space.gutter})`,
  },
  // How far the listener got: a short bar, or a check, then the time.
  meta: {
    alignItems: "center",
    color: color.secondaryLabel,
    display: "flex",
    fontSize: font.caption,
    fontVariantNumeric: "tabular-nums",
    gap: space.sm,
    lineHeight: 1.3,
    marginTop: space.xs,
    whiteSpace: "nowrap",
  },
  metaFill: (share: number) => ({
    backgroundColor: color.accent,
    borderRadius: radius.full,
    display: "block",
    height: "100%",
    width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`,
  }),
  metaIcon: { color: color.accentText, display: "flex" },
  metaTrack: {
    backgroundColor: color.fill,
    borderRadius: radius.full,
    display: "block",
    // Gives way to the text on narrow rows.
    flexShrink: 1,
    height: "3px",
    minWidth: "1.5rem",
    overflow: "hidden",
    width: "4rem",
  },
  // A touch smaller than a regular icon button's glyph.
  more: { fontSize: font.callout },
  pressable: {
    backgroundColor: {
      ":active": color.surfacePressed,
      ":hover": { [media.hover]: color.surfacePressed, default: null },
      default: "transparent",
    },
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
  // Smaller than a settings row, in step with the media title.
  subtitleMedia: { fontSize: font.footnote },
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
  // As in Audible: one line, so every row keeps a steady height.
  titleMedia: {
    fontSize: font.subheadline,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  // Clear of the text, and close to the more button.
  trailing: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    paddingInlineEnd: space.sm,
    paddingInlineStart: space.xs,
  },
});

/** How a section sets its rows. */
export type ListVariant = "grouped" | "media";

const VariantContext = createContext<ListVariant>("grouped");

export interface ListSectionProps {
  readonly children: ReactNode;
  /** A short heading above the section. */
  readonly header?: string;
  /** Help text below the section. */
  readonly footer?: string;
  /**
   * `grouped` sets settings in a rounded card, as iOS Settings does.
   * `media` sets narrations on the canvas, edge to edge, under a bold
   * heading, with artwork and compact one-line text, as Podcasts does.
   */
  readonly variant?: ListVariant;
}

/** A section of list rows. Its variant sets how every row in it looks. */
export const ListSection = ({
  children,
  footer,
  header,
  variant = "grouped",
}: ListSectionProps) => {
  const isMedia = variant === "media";
  const list = (
    <VariantContext value={variant}>
      <ul
        {...stylex.props(
          isMedia && plainTheme,
          styles.list,
          isMedia && styles.mediaList
        )}
      >
        {children}
      </ul>
    </VariantContext>
  );
  if (isMedia && header) {
    return (
      <Section title={header} footer={footer}>
        {list}
      </Section>
    );
  }
  return (
    <section {...stylex.props(styles.section)}>
      {header && <h2 {...stylex.props(styles.header)}>{header}</h2>}
      {list}
      {footer && <div {...stylex.props(styles.footer)}>{footer}</div>}
    </section>
  );
};

/** A third line under a media row's subtitle, such as the time left. */
export interface RowMeta {
  readonly text: string;
  /** How much is done, from 0 to 1, shown as a short bar. */
  readonly progress?: number;
  /** All done, shown as a check. */
  readonly done?: boolean;
}

interface RowContent {
  readonly title: string;
  /** A second line under the title. */
  readonly subtitle?: string;
  /** A third line, in media sections. */
  readonly meta?: RowMeta;
  /** Before the text, such as an icon or artwork. */
  readonly leading?: ReactNode;
  /** Trailing text, such as a status. */
  readonly detail?: string;
  /** After the detail. Pressable rows show a chevron by default. */
  readonly accessory?: ReactNode;
  /** A destructive action, such as Sign out, reads in red. */
  readonly tone?: "destructive";
}

const Meta = ({ meta }: { meta: RowMeta }) => {
  let mark: ReactNode = null;
  if (meta.done) {
    mark = (
      <span {...stylex.props(styles.metaIcon)}>
        <CheckIcon />
      </span>
    );
  } else if (meta.progress !== undefined) {
    mark = (
      <span aria-hidden="true" {...stylex.props(styles.metaTrack)}>
        <span {...stylex.props(styles.metaFill(meta.progress))} />
      </span>
    );
  }
  return (
    <span {...stylex.props(styles.meta)}>
      {mark}
      {meta.text}
    </span>
  );
};

const Content = ({
  accessory,
  detail,
  leading,
  meta,
  subtitle,
  title,
  tone,
}: RowContent) => {
  const isMedia = useContext(VariantContext) === "media";
  return (
    <>
      {leading && <span {...stylex.props(styles.leading)}>{leading}</span>}
      <span {...stylex.props(styles.text)}>
        <span
          {...stylex.props(
            styles.title,
            isMedia && styles.titleMedia,
            isMedia && recipes.truncate,
            tone === "destructive" && styles.destructive
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span
            {...stylex.props(
              styles.subtitle,
              isMedia && styles.subtitleMedia,
              isMedia && recipes.truncate
            )}
          >
            {subtitle}
          </span>
        )}
        {meta && <Meta meta={meta} />}
      </span>
      {detail && <span {...stylex.props(styles.detail)}>{detail}</span>}
      {accessory && (
        <span {...stylex.props(styles.accessory)}>{accessory}</span>
      )}
    </>
  );
};

const CHEVRON = <ChevronRightIcon />;

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
   * control, such as the more button.
   */
  readonly swipeAction?: SwipeAction;
  /** A small round button after the text, such as Play. */
  readonly action?: RowAction;
  /** A more button at the end, opening the row's other actions. */
  readonly more?: Omit<RowAction, "icon">;
}

/** A control a row offers besides pressing it. */
export interface RowAction {
  /** The accessible name, such as "Play How the brain learns to read". */
  readonly label: string;
  readonly icon: ReactNode;
  readonly onClick: () => void;
}

/** A row that performs an action. */
export const ListButton = ({
  accessory,
  action,
  detail,
  leading,
  meta,
  more,
  subtitle,
  swipeAction,
  title,
  tone,
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
            recipes.focusRingInset,
            styles.row,
            styles.pressable,
            props.disabled && styles.disabled
          )}
        >
          <Content
            accessory={accessory}
            detail={detail}
            leading={leading}
            meta={meta}
            subtitle={subtitle}
            title={title}
            tone={tone}
          />
        </button>
        {(action || more) && (
          <span {...stylex.props(styles.trailing)}>
            {action && (
              <IconButton
                label={action.label}
                icon={action.icon}
                variant="outline"
                size="small"
                onClick={() => action.onClick()}
              />
            )}
            {more && (
              <IconButton
                label={more.label}
                icon={<EllipsisIcon />}
                variant="plain"
                style={styles.more}
                onClick={() => more.onClick()}
              />
            )}
          </span>
        )}
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
  meta,
  subtitle,
  title,
  tone,
  ...props
}: ListLinkProps) => (
  <li {...stylex.props(styles.item)}>
    <a
      {...props}
      {...stylex.props(recipes.focusRingInset, styles.row, styles.pressable)}
    >
      <Content
        accessory={accessory}
        detail={detail}
        leading={leading}
        meta={meta}
        subtitle={subtitle}
        title={title}
        tone={tone}
      />
    </a>
  </li>
);
