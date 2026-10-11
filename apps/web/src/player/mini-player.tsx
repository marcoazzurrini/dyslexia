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
const COVER = "2.75rem";

const styles = stylex.create({
  bar: {
    alignItems: "center",
    display: "flex",
    gap: space.xs,
    paddingInlineEnd: space.sm,
  },
  // Round, to sit in the capsule as the bar's ends do.
  cover: {
    borderRadius: radius.full,
    flexShrink: 0,
    overflow: "hidden",
    width: COVER,
  },
  // Floats just above the tab bar, with content fading out behind it.
  dock: {
    "::before": {
      backgroundImage: `linear-gradient(to top, ${color.canvas} 70%, transparent)`,
      bottom: 0,
      content: "''",
      height: `calc(100% + ${space.xl})`,
      insetInline: 0,
      position: "absolute",
      zIndex: -1,
    },
    bottom: `calc(max(${space.sm}, env(safe-area-inset-bottom)) + ${size.tabBar} + ${space.sm})`,
    zIndex: 20,
  },
  loading: {
    alignItems: "center",
    display: "flex",
    height: size.touch,
    justifyContent: "center",
    width: size.touch,
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
    // Even all around the cover, so it sits concentric with the bar's end.
    paddingInlineStart: `calc((${size.tabBar} - ${COVER}) / 2)`,
    textAlign: "start",
  },
  // A plain glyph, as the play button beside it.
  seek: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radius.full,
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexShrink: 0,
    fontSize: "1.35rem",
    height: size.touch,
    justifyContent: "center",
    opacity: { ":active": 0.5, ":disabled": 0.35, default: 1 },
    padding: 0,
    width: size.touch,
  },
  text: { display: "flex", flexDirection: "column", minWidth: 0 },
  time: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
  },
  title: {
    fontSize: font.subheadline,
    fontWeight: 600,
    lineHeight: 1.3,
  },
});

/** Height the mini player covers, kept clear at the bottom of screens. */
export const MINI_PLAYER_INSET = `calc(${size.tabBar} + ${space.sm})`;

/**
 * A floating bar that keeps the current recording in reach on every
 * screen. Pressing it opens the full player.
 */
export const MiniPlayer = ({
  onExpand,
  recording,
  view,
}: {
  onExpand: () => void;
  recording: Recording;
  view: PlaybackView;
}) => (
  <div {...stylex.props(recipes.bottomDock, styles.dock)}>
    <div {...stylex.props(recipes.bottomBar, styles.bar)}>
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
  </div>
);
