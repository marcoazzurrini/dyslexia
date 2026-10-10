import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { PlayIcon } from "./icons.tsx";
import { ProgressBar } from "./progress.tsx";
import { recipes } from "./recipes.ts";
import { color, font, radius, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  card: {
    borderRadius: radius.lg,
    borderStyle: "none",
    color: color.onAccent,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    fontFamily: font.family,
    gap: space.md,
    minHeight: "13rem",
    outlineOffset: "3px",
    padding: space.lg,
    scrollSnapAlign: "start",
    textAlign: "start",
    width: "min(17rem, 78vw)",
  },
  // Leads the card, over a darker shade of its own color.
  cardCover: {
    borderRadius: radius.md,
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.24)",
    flexShrink: 0,
    overflow: "hidden",
    width: "4.25rem",
  },
  cardMeta: { fontSize: font.subheadline, lineHeight: 1.4, opacity: 0.9 },
  cardPlay: {
    alignItems: "center",
    backgroundColor: color.onAccent,
    borderRadius: radius.full,
    display: "flex",
    flexShrink: 0,
    fontSize: "1.25rem",
    height: "2.75rem",
    justifyContent: "center",
    width: "2.75rem",
  },
  cardPlayTint: (tint: string) => ({ color: tint }),
  cardText: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxs,
    marginTop: "auto",
  },
  // A darker shade of the artwork's color, so the artwork stands out on it.
  cardTint: (tint: string) => ({
    backgroundColor: `color-mix(in oklab, ${tint} 62%, black)`,
  }),
  cardTitle: {
    fontSize: font.title3,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  cardTop: {
    alignItems: "flex-start",
    display: "flex",
    justifyContent: "space-between",
  },
  // The only card on its shelf spans the screen.
  cardWide: { width: "100%" },
  progress: { display: "block", paddingTop: space.sm },
  tile: {
    backgroundColor: "transparent",
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    fontFamily: font.family,
    gap: space.xs,
    outlineOffset: "3px",
    padding: 0,
    scrollSnapAlign: "start",
    textAlign: "start",
    width: "9.5rem",
  },
  tileCover: {
    borderRadius: radius.md,
    boxShadow: "0 6px 16px rgb(0 0 0 / 0.14), 0 1px 3px rgb(0 0 0 / 0.08)",
    display: "block",
    overflow: "hidden",
  },
  tileMeta: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    lineHeight: 1.35,
  },
  tileTitle: {
    fontSize: font.subheadline,
    fontWeight: 600,
    lineHeight: 1.35,
    marginTop: space.xs,
  },
});

interface MediaProps {
  /** The accessible name, such as "Play How the brain learns to read". */
  readonly label: string;
  /** A `Cover`, which the card or tile sizes. */
  readonly artwork: ReactNode;
  readonly title: string;
  /** A line under the title, such as the site and the time left. */
  readonly meta: string;
  readonly onClick: () => void;
}

export interface MediaCardProps extends MediaProps {
  /** The artwork's color; the card takes a darker shade of it. */
  readonly tint: string;
  /** How much is done, from 0 to 1. */
  readonly progress: number;
  /** Spans the screen, when it is the only card on its shelf. */
  readonly wide?: boolean;
}

/** Something to pick up, as a card in its artwork's color, as Podcasts shows Up Next. */
export const MediaCard = ({
  artwork,
  label,
  meta,
  onClick,
  progress,
  tint,
  title,
  wide = false,
}: MediaCardProps) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    {...stylex.props(
      recipes.focusRing,
      recipes.pressSurface,
      styles.card,
      styles.cardTint(tint),
      wide && styles.cardWide
    )}
  >
    <span {...stylex.props(styles.cardTop)}>
      <span {...stylex.props(styles.cardCover)}>{artwork}</span>
      <span
        aria-hidden="true"
        {...stylex.props(styles.cardPlay, styles.cardPlayTint(tint))}
      >
        <PlayIcon />
      </span>
    </span>
    <span {...stylex.props(styles.cardText)}>
      <span {...stylex.props(styles.cardTitle, recipes.clampTwo)}>{title}</span>
      <span {...stylex.props(styles.cardMeta)}>{meta}</span>
      <span {...stylex.props(styles.progress)}>
        <ProgressBar
          label="Listened"
          size="thin"
          tone="onColor"
          value={progress}
          max={1}
        />
      </span>
    </span>
  </button>
);

export type MediaTileProps = MediaProps;

/** Something new, on a shelf: its artwork, title, and a line about it. */
export const MediaTile = ({
  artwork,
  label,
  meta,
  onClick,
  title,
}: MediaTileProps) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    {...stylex.props(recipes.focusRing, recipes.press, styles.tile)}
  >
    <span {...stylex.props(styles.tileCover)}>{artwork}</span>
    <span {...stylex.props(styles.tileTitle, recipes.clampTwo)}>{title}</span>
    <span {...stylex.props(styles.tileMeta)}>{meta}</span>
  </button>
);
