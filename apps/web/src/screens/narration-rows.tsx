import type { Narration } from "@dyslexia/narrations/client";
import {
  ActivityIndicator,
  CheckIcon,
  EllipsisIcon,
  PlayIcon,
  IconButton,
  ListButton,
  ListRow,
  ProgressBar,
  WarningIcon,
} from "@dyslexia/ui";
import {
  color,
  font,
  media,
  motion,
  radius,
  space,
} from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

import { Cover, hueOf } from "../components/cover";
import type { Listening } from "../lib/listening";
import { formatDuration, siteOf } from "../lib/recording";

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
    outlineColor: color.focus,
    outlineOffset: "3px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
    padding: space.lg,
    scrollSnapAlign: "start",
    textAlign: "start",
    touchAction: "manipulation",
    transform: {
      ":active": { default: "scale(0.98)", [media.reducedMotion]: "none" },
      default: "none",
    },
    transitionDuration: motion.fast,
    transitionProperty: "transform",
    transitionTimingFunction: motion.easeOut,
    width: "min(17rem, 78vw)",
  },
  // A darker shade of the cover's color, so the cover stands out on it.
  cardHue: (hue: string) => ({
    backgroundColor: `color-mix(in oklab, ${hue} 62%, black)`,
  }),
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
  cardPlayHue: (hue: string) => ({ color: hue }),
  cardText: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxs,
    marginTop: "auto",
  },
  cardTitle: {
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    display: "-webkit-box",
    fontSize: font.title3,
    fontWeight: 700,
    lineHeight: 1.3,
    overflow: "hidden",
  },
  cardTop: {
    alignItems: "flex-start",
    display: "flex",
    justifyContent: "space-between",
  },
  // The only card on its shelf spans the screen.
  cardWide: { width: "100%" },
  // As in Audible: a short bar of how far the listener got, then the time.
  listening: {
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
  listeningFill: (share: number) => ({
    backgroundColor: color.accent,
    borderRadius: radius.full,
    display: "block",
    height: "100%",
    width: `${Math.round(Math.min(1, share) * 100)}%`,
  }),
  listeningIcon: { color: color.accentText, display: "flex" },
  listeningTrack: {
    backgroundColor: color.fill,
    borderRadius: radius.full,
    display: "block",
    // Gives way to the time on narrow rows.
    flexShrink: 1,
    height: "3px",
    minWidth: "1.5rem",
    overflow: "hidden",
    width: "4rem",
  },
  // As in Audible: a round play glyph after the text, saying what pressing
  // the row does.
  // A touch smaller than a regular icon button's glyph.
  more: { fontSize: font.callout },
  play: {
    alignItems: "center",
    borderColor: color.separator,
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: "1px",
    color: color.label,
    display: "flex",
    flexShrink: 0,
    fontSize: "0.625rem",
    height: "1.5rem",
    justifyContent: "center",
    // Clear of the title, and close to the more button after the row.
    marginInlineEnd: `calc(-1 * ${space.lg})`,
    marginInlineStart: space.sm,
    // The glyph centers its weight, which reads slightly right in a circle
    // this small; nudge it halfway back to its box's center.
    paddingInlineEnd: "1.5px",
    width: "1.5rem",
  },
  progress: { display: "block", paddingTop: space.sm },
  // Smaller than a list subtitle, in step with the smaller title.
  site: {
    color: color.secondaryLabel,
    display: "block",
    fontSize: font.footnote,
  },
  tile: {
    backgroundColor: "transparent",
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    fontFamily: font.family,
    gap: space.xs,
    outlineColor: color.focus,
    outlineOffset: "3px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
    padding: 0,
    scrollSnapAlign: "start",
    textAlign: "start",
    touchAction: "manipulation",
    transform: {
      ":active": { default: "scale(0.97)", [media.reducedMotion]: "none" },
      default: "none",
    },
    transitionDuration: motion.fast,
    transitionProperty: "transform",
    transitionTimingFunction: motion.easeOut,
    width: "9.5rem",
  },
  tileMeta: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    lineHeight: 1.35,
  },
  tileTitle: {
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    display: "-webkit-box",
    fontSize: font.subheadline,
    fontWeight: 600,
    lineHeight: 1.35,
    marginTop: space.xs,
    overflow: "hidden",
  },
  // As in Audible: one line, ending in an ellipsis, so every row keeps a
  // steady height. The options sheet shows the full title.
  title: {
    display: "block",
    fontSize: font.subheadline,
    fontWeight: 600,
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

type Making = Extract<Narration, { state: "making" }>;
type Ready = Extract<Narration, { state: "ready" }>;
type Failed = Extract<Narration, { state: "failed" }>;

/** What a narration in progress is doing, such as "Recording 3 of 8". */
export const progressOf = ({ progress, stage }: Making) => {
  if (stage === "reading") {
    return "Reading the article…";
  }
  if (stage === "writing") {
    return "Writing the narration…";
  }
  return progress
    ? `Recording ${progress.done} of ${progress.total}…`
    : "Recording…";
};

/** A narration being made, with what it is doing. */
export const MakingRow = ({ narration }: { narration: Making }) => (
  <ListRow
    leading={
      <Cover url={narration.url} size="row" tone="neutral">
        <ActivityIndicator />
      </Cover>
    }
    title={narration.title}
    subtitle={progressOf(narration)}
  />
);

/**
 * How far the listener got with a ready narration: its length, a short bar
 * with the time left, or that it is finished.
 */
const ListeningLine = ({
  listening,
  narration,
}: {
  listening: Listening;
  narration: Ready;
}) => {
  if (listening.status === "finished") {
    return (
      <span {...stylex.props(styles.listening)}>
        <span {...stylex.props(styles.listeningIcon)}>
          <CheckIcon />
        </span>
        Finished
      </span>
    );
  }
  if (listening.status === "not-started") {
    return (
      <span {...stylex.props(styles.listening)}>
        {formatDuration(narration.durationSeconds)}
      </span>
    );
  }
  return (
    <span {...stylex.props(styles.listening)}>
      <span aria-hidden="true" {...stylex.props(styles.listeningTrack)}>
        <span
          {...stylex.props(
            styles.listeningFill(listening.position / narration.durationSeconds)
          )}
        />
      </span>
      {formatDuration(listening.remaining)} left
    </span>
  );
};

export interface ReadyRowProps {
  readonly narration: Ready;
  readonly listening: Listening;
  readonly onPlay: (narration: Ready) => void;
  /** Offers Delete by swiping and through an options button. */
  readonly onOptions?: (narration: Ready) => void;
  readonly onDelete?: (narration: Ready) => void;
}

/** A narration ready to play, with how far the listener got. */
export const ReadyRow = ({
  listening,
  narration,
  onDelete,
  onOptions,
  onPlay,
}: ReadyRowProps) => (
  <ListButton
    aria-label={`Play ${narration.title}`}
    leading={<Cover url={narration.url} size="row" />}
    title={<span {...stylex.props(styles.title)}>{narration.title}</span>}
    subtitle={
      <>
        <span {...stylex.props(styles.site)}>{siteOf(narration.url)}</span>
        <ListeningLine listening={listening} narration={narration} />
      </>
    }
    accessory={
      <span aria-hidden="true" {...stylex.props(styles.play)}>
        <PlayIcon />
      </span>
    }
    onClick={() => onPlay(narration)}
    swipeAction={
      onDelete && { label: "Delete", onAction: () => onDelete(narration) }
    }
    trailing={
      onOptions && (
        <IconButton
          label={`Options for ${narration.title}`}
          icon={<EllipsisIcon />}
          variant="plain"
          style={styles.more}
          onClick={() => onOptions(narration)}
        />
      )
    }
  />
);

/**
 * A narration to pick up, as a card in a darker shade of its cover's color,
 * as Podcasts shows what is up next.
 */
export const ResumeCard = ({
  listening,
  narration,
  onPlay,
  wide = false,
}: {
  narration: Ready;
  listening: Listening;
  onPlay: (narration: Ready) => void;
  /** Spans the screen, when it is the only card on its shelf. */
  wide?: boolean;
}) => {
  const hue = hueOf(siteOf(narration.url));
  return (
    <button
      type="button"
      aria-label={`Play ${narration.title}`}
      onClick={() => onPlay(narration)}
      {...stylex.props(
        styles.card,
        styles.cardHue(hue),
        wide && styles.cardWide
      )}
    >
      <span {...stylex.props(styles.cardTop)}>
        <Cover url={narration.url} size="card" />
        <span
          aria-hidden="true"
          {...stylex.props(styles.cardPlay, styles.cardPlayHue(hue))}
        >
          <PlayIcon />
        </span>
      </span>
      <span {...stylex.props(styles.cardText)}>
        <span {...stylex.props(styles.cardTitle)}>{narration.title}</span>
        <span {...stylex.props(styles.cardMeta)}>
          {siteOf(narration.url)} · {formatDuration(listening.remaining)} left
        </span>
        <span {...stylex.props(styles.progress)}>
          <ProgressBar
            label="Listened"
            size="thin"
            tone="onColor"
            value={listening.position}
            max={narration.durationSeconds}
          />
        </span>
      </span>
    </button>
  );
};

/** A narration on a shelf: its cover, title, and length. */
export const ShelfTile = ({
  narration,
  onPlay,
}: {
  narration: Ready;
  onPlay: (narration: Ready) => void;
}) => (
  <button
    type="button"
    aria-label={`Play ${narration.title}`}
    onClick={() => onPlay(narration)}
    {...stylex.props(styles.tile)}
  >
    <Cover url={narration.url} size="shelf" />
    <span {...stylex.props(styles.tileTitle)}>{narration.title}</span>
    <span {...stylex.props(styles.tileMeta)}>
      {siteOf(narration.url)} · {formatDuration(narration.durationSeconds)}
    </span>
  </button>
);

/** A narration that could not be made. Pressing it explains why. */
export const FailedRow = ({
  narration,
  onDelete,
  onOpen,
}: {
  narration: Failed;
  onOpen: (narration: Failed) => void;
  onDelete?: (narration: Failed) => void;
}) => (
  <ListButton
    leading={
      <Cover url={narration.url} size="row" tone="danger">
        <WarningIcon />
      </Cover>
    }
    title={narration.title}
    subtitle={siteOf(narration.url)}
    onClick={() => onOpen(narration)}
    swipeAction={
      onDelete && { label: "Delete", onAction: () => onDelete(narration) }
    }
  />
);
