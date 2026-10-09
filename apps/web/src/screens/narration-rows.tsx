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
  // As in Podcasts: a small tinted capsule saying what pressing will do.
  capsule: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: color.accentFill,
    borderRadius: radius.full,
    color: color.accentText,
    display: "inline-flex",
    fontSize: font.footnote,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
    gap: space.xs,
    lineHeight: 1.3,
    marginTop: space.xs,
    paddingBlock: space.xxs,
    paddingInline: space.sm,
  },
  capsuleDone: { backgroundColor: color.fill, color: color.secondaryLabel },
  capsuleFill: (share: number) => ({
    backgroundColor: color.accentText,
    borderRadius: radius.full,
    display: "block",
    height: "100%",
    width: `${Math.round(share * 100)}%`,
  }),
  capsuleIcon: { display: "flex", fontSize: "0.85em" },
  capsuleTrack: {
    backgroundColor: color.separator,
    borderRadius: radius.full,
    display: "block",
    height: "3px",
    overflow: "hidden",
    width: "1.75rem",
  },
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
  progress: { display: "block", paddingTop: space.sm },
  site: { color: color.secondaryLabel, display: "block" },
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
  title: { display: "block", fontWeight: 600, textWrap: "balance" },
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
 * What pressing a ready narration does, and how far the listener got: its
 * length, the time left with a small bar, or that it is finished.
 */
const ListeningCapsule = ({
  listening,
  narration,
}: {
  listening: Listening;
  narration: Ready;
}) => {
  if (listening.status === "finished") {
    return (
      <span {...stylex.props(styles.capsule, styles.capsuleDone)}>
        <span {...stylex.props(styles.capsuleIcon)}>
          <CheckIcon />
        </span>
        Finished
      </span>
    );
  }
  return (
    <span {...stylex.props(styles.capsule)}>
      <span {...stylex.props(styles.capsuleIcon)}>
        <PlayIcon />
      </span>
      {listening.status === "in-progress" ? (
        <>
          <span aria-hidden="true" {...stylex.props(styles.capsuleTrack)}>
            <span
              {...stylex.props(
                styles.capsuleFill(
                  listening.position / narration.durationSeconds
                )
              )}
            />
          </span>
          {formatDuration(listening.remaining)} left
        </>
      ) : (
        formatDuration(narration.durationSeconds)
      )}
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
        <ListeningCapsule listening={listening} narration={narration} />
      </>
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
