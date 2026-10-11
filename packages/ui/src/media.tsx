import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import type { RowAction } from "./list.tsx";
import { ProgressBar } from "./progress.tsx";
import { recipes } from "./recipes.ts";
import { color, font, media, radius, size, space } from "./tokens.stylex.ts";

/** The width of a tile, and of its square cover. */
const TILE = "9.5rem";

/** The size of a tile's play button. */
const TILE_PLAY = "2rem";

const styles = stylex.create({
  card: {
    borderRadius: radius.lg,
    borderStyle: "none",
    color: color.onAccent,
    display: "flex",
    flexDirection: "column",
    fontFamily: font.family,
    gap: space.md,
    height: "100%",
    minHeight: "13rem",
    outlineOffset: "3px",
    padding: space.lg,
    textAlign: "start",
    width: "100%",
  },
  // Leads the card, over a darker shade of its own color.
  cardCover: {
    borderRadius: radius.md,
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.24)",
    flexShrink: 0,
    overflow: "hidden",
    width: "4.25rem",
  },
  // Holds the card and its play button, which cannot sit inside it.
  cardFrame: {
    flexShrink: 0,
    position: "relative",
    scrollSnapAlign: "start",
    width: "min(17rem, 78vw)",
  },
  cardMeta: { fontSize: font.subheadline, lineHeight: 1.4, opacity: 0.9 },
  // Over the card's top corner, where the play glyph sits in Podcasts.
  cardPlay: {
    alignItems: "center",
    backgroundColor: color.onAccent,
    borderRadius: radius.full,
    borderStyle: "none",
    display: "flex",
    fontSize: "1.25rem",
    height: size.touch,
    insetBlockStart: space.lg,
    insetInlineEnd: space.lg,
    justifyContent: "center",
    padding: 0,
    position: "absolute",
    width: size.touch,
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
  // The only card on its shelf spans the screen.
  cardWide: { width: "100%" },
  progress: { display: "block", paddingTop: space.sm },
  tile: {
    backgroundColor: "transparent",
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexDirection: "column",
    fontFamily: font.family,
    gap: space.xs,
    outlineOffset: "3px",
    padding: 0,
    textAlign: "start",
    width: "100%",
  },
  tileCover: {
    borderRadius: radius.md,
    boxShadow: "0 6px 16px rgb(0 0 0 / 0.14), 0 1px 3px rgb(0 0 0 / 0.08)",
    display: "block",
    overflow: "hidden",
  },
  tileFrame: {
    flexShrink: 0,
    position: "relative",
    scrollSnapAlign: "start",
    width: TILE,
  },
  tileMeta: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    lineHeight: 1.35,
  },
  // A glass disc on the cover's corner, as Music plays an album from its art.
  // Its touch area stays the full 44px.
  tilePlay: {
    "::before": {
      content: "''",
      inset: `calc((${TILE_PLAY} - ${size.touch}) / 2)`,
      position: "absolute",
    },
    alignItems: "center",
    backdropFilter: {
      default: "blur(16px) saturate(180%)",
      [media.reducedTransparency]: "none",
    },
    backgroundColor: {
      default: color.glass,
      [media.reducedTransparency]: color.surface,
    },
    borderRadius: radius.full,
    borderStyle: "none",
    boxShadow: "0 2px 8px rgb(0 0 0 / 0.18)",
    color: color.label,
    display: "flex",
    fontSize: "0.75rem",
    height: TILE_PLAY,
    insetInlineEnd: space.sm,
    justifyContent: "center",
    padding: 0,
    position: "absolute",
    top: `calc(${TILE} - ${TILE_PLAY} - ${space.sm})`,
    width: TILE_PLAY,
  },
  tileTitle: {
    fontSize: font.subheadline,
    fontWeight: 600,
    lineHeight: 1.35,
    marginTop: space.xs,
  },
});

interface MediaProps {
  /** The accessible name, such as "How the brain learns to read". */
  readonly label: string;
  /** A `Cover`, which the card or tile sizes. */
  readonly artwork: ReactNode;
  readonly title: string;
  /** A line under the title, such as the site and the time left. */
  readonly meta: string;
  /** Pressing the card or tile, such as to open it. */
  readonly onClick: () => void;
  /** A round button on it, such as Play, that acts without opening it. */
  readonly action?: RowAction;
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
  action,
  artwork,
  label,
  meta,
  onClick,
  progress,
  tint,
  title,
  wide = false,
}: MediaCardProps) => (
  <div {...stylex.props(styles.cardFrame, wide && styles.cardWide)}>
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...stylex.props(
        recipes.focusRing,
        recipes.pressSurface,
        styles.card,
        styles.cardTint(tint)
      )}
    >
      <span {...stylex.props(styles.cardCover)}>{artwork}</span>
      <span {...stylex.props(styles.cardText)}>
        <span {...stylex.props(styles.cardTitle, recipes.clampTwo)}>
          {title}
        </span>
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
    {action && (
      <button
        type="button"
        aria-label={action.label}
        onClick={() => action.onClick()}
        {...stylex.props(
          recipes.focusRing,
          recipes.press,
          styles.cardPlay,
          styles.cardPlayTint(tint)
        )}
      >
        {action.icon}
      </button>
    )}
  </div>
);

export type MediaTileProps = MediaProps;

/** Something new, on a shelf: its artwork, title, and a line about it. */
export const MediaTile = ({
  action,
  artwork,
  label,
  meta,
  onClick,
  title,
}: MediaTileProps) => (
  <div {...stylex.props(styles.tileFrame)}>
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
    {action && (
      <button
        type="button"
        aria-label={action.label}
        onClick={() => action.onClick()}
        {...stylex.props(recipes.focusRing, recipes.press, styles.tilePlay)}
      >
        {action.icon}
      </button>
    )}
  </div>
);
