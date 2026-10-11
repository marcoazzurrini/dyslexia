import {
  ActivityIndicator,
  Cover,
  ForwardIcon,
  IconButton,
  PauseIcon,
  PlayIcon,
  recipes,
} from "@dyslexia/ui";
import { color, font, radius, size, space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { SeekButton, Time } from "@videojs/react";

import type { Recording } from "../lib/recording";
import { coverOf } from "../lib/recording";
import type { PlaybackView } from "./player";

/** The width of the cover. */
const COVER = "2.25rem";

/** Play and skip: small glyphs, close together, so the title gets room. */
const GLYPH = "1.15rem";

/** Each control's width. Its touch area keeps the full height. */
const CONTROL = "2.25rem";

const styles = stylex.create({
  bar: {
    alignItems: "center",
    display: "flex",
    height: size.miniPlayer,
    // The glyphs' own margin makes this match the cover's side.
    paddingInlineEnd: space.xs,
  },
  // Round, to sit in the capsule as the bar's ends do.
  cover: {
    borderRadius: radius.full,
    flexShrink: 0,
    overflow: "hidden",
    width: COVER,
  },
  loading: {
    alignItems: "center",
    display: "flex",
    height: size.touch,
    justifyContent: "center",
    width: CONTROL,
  },
  open: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "transparent",
    borderRadius: radius.full,
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexGrow: 1,
    gap: space.md,
    minWidth: 0,
    paddingInlineEnd: space.sm,
    paddingInlineStart: space.md,
    textAlign: "start",
  },
  play: { fontSize: GLYPH, width: CONTROL },
  // A plain glyph, as the play button beside it.
  seek: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radius.full,
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexShrink: 0,
    fontSize: GLYPH,
    height: size.touch,
    justifyContent: "center",
    opacity: { ":active": 0.5, ":disabled": 0.35, default: 1 },
    padding: 0,
    width: CONTROL,
  },
  text: { display: "flex", flexDirection: "column", minWidth: 0 },
  time: {
    color: color.secondaryLabel,
    fontSize: font.caption,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
  },
  title: {
    fontSize: font.subheadline,
    fontWeight: 600,
    lineHeight: 1.3,
  },
});

/**
 * The tray atop the tab bar that keeps the current recording in reach on
 * every screen. Pressing it opens the full player.
 */
export const MiniPlayer = ({
  hidden,
  onExpand,
  recording,
  view,
}: {
  /** The full player covers it, so it leaves the accessibility tree. */
  hidden: boolean;
  onExpand: () => void;
  recording: Recording;
  view: PlaybackView;
}) => (
  <div inert={hidden} {...stylex.props(styles.bar)}>
    <button
      type="button"
      aria-label={`Open player: ${recording.title}`}
      onClick={onExpand}
      {...stylex.props(
        recipes.focusRingInset,
        recipes.pressSurface,
        styles.open
      )}
    >
      <span {...stylex.props(styles.cover)}>
        <Cover {...coverOf(recording.sourceUrl)} />
      </span>
      <span {...stylex.props(styles.text)}>
        <span {...stylex.props(styles.title, recipes.truncate)}>
          {recording.title}
        </span>
        <span {...stylex.props(styles.time)}>
          {view.failed ? (
            "Audio could not play"
          ) : (
            <>
              <Time.Value type="remaining" negativeSign="" /> left
            </>
          )}
        </span>
      </span>
    </button>
    {view.status === "loading" && !view.failed ? (
      <span {...stylex.props(styles.loading)}>
        <ActivityIndicator label="Loading audio" />
      </span>
    ) : (
      <IconButton
        label={view.status === "playing" ? "pause" : "play"}
        icon={view.status === "playing" ? <PauseIcon /> : <PlayIcon />}
        variant="plain"
        style={styles.play}
        disabled={view.failed}
        onClick={view.handleToggle}
      />
    )}
    <SeekButton
      seconds={15}
      label="seek forward 15 seconds"
      disabled={!view.canSeek}
      {...stylex.props(recipes.focusRing, styles.seek)}
    >
      <ForwardIcon />
    </SeekButton>
  </div>
);
