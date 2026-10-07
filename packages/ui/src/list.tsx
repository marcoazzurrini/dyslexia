import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

import { ChevronRightIcon } from "./icons.tsx";
import { color, font, media, radius, size, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  accessory: {
    color: color.tertiaryLabel,
    display: "flex",
    flexShrink: 0,
  },
  detail: {
    color: color.secondaryLabel,
    flexShrink: 0,
    fontSize: font.subheadline,
    textAlign: "end",
  },
  disabled: { cursor: "not-allowed", opacity: 0.5 },
  footer: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    lineHeight: 1.4,
    paddingInline: space.lg,
  },
  header: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    fontWeight: 600,
    lineHeight: 1.35,
    paddingInline: space.lg,
  },
  // The icon tile is 2rem wide, followed by the row gap.
  iconInset: {
    backgroundImage: `linear-gradient(to right, ${color.surface} calc(${space.lg} + 2rem + ${space.md}), ${color.separator} calc(${space.lg} + 2rem + ${space.md}))`,
  },
  item: {
    backgroundColor: color.surface,
    display: "flex",
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
});

const CHEVRON = <ChevronRightIcon />;

export interface ListSectionProps {
  readonly children: ReactNode;
  /** A short heading above the section. */
  readonly header?: ReactNode;
  /** Help text below the section. */
  readonly footer?: ReactNode;
  /** Rows start with an icon tile, so separators start after it. */
  readonly withIcons?: boolean;
  readonly style?: StyleXStyles;
}

/** An inset grouped list section, as in iOS Settings. Holds list rows. */
export const ListSection = ({
  children,
  footer,
  header,
  style,
  withIcons = false,
}: ListSectionProps) => (
  <section {...stylex.props(styles.section, style)}>
    {header && <h2 {...stylex.props(styles.header)}>{header}</h2>}
    <ul {...stylex.props(styles.list, withIcons && styles.iconInset)}>
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
    Omit<ComponentProps<"button">, "className" | "style" | "title"> {}

/** A row that performs an action. */
export const ListButton = ({
  accessory,
  detail,
  leading,
  subtitle,
  title,
  type = "button",
  ...props
}: ListButtonProps) => (
  <li {...stylex.props(styles.item)}>
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
  </li>
);

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
