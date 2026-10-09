import {
  ActivityIndicator,
  ForwardIcon,
  IconButton,
  PauseIcon,
  PlayIcon,
} from "@dyslexia/ui";
import {
  color,
  font,
  media,
  motion,
  radius,
  size,
  space,
} from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { SeekButton, Time } from "@videojs/react";

import { Cover } from "../components/cover";
import type { Recording } from "../lib/recording";
import type { PlaybackView } from "./player";

const styles = stylex.create({
  bar: {
    alignItems: "center",
    backdropFilter: {
      default: "blur(24px) saturate(180%)",
      [media.reducedTransparency]: "none",
    },
    backgroundColor: {
      default: color.glass,
      [media.reducedTransparency]: color.elevated,
    },
    borderRadius: radius.lg,
    boxShadow: `inset 0 0.5px 0 ${color.glassEdge}, 0 8px 30px rgb(0 0 0 / 0.16)`,
    display: "flex",
    gap: space.xs,
    marginInline: "auto",
    maxWidth: size.dock,
    minHeight: "3.75rem",
    paddingInlineEnd: space.sm,
    pointerEvents: "auto",
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
    insetInline: 0,
    paddingInline: `max(${space.sm}, env(safe-area-inset-left))`,
    pointerEvents: "none",
    position: "fixed",
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
    backgroundColor: "transparent",
    borderRadius: radius.lg,
    borderStyle: "none",
    color: color.label,
    display: "flex",
    flexGrow: 1,
    gap: space.md,
    minWidth: 0,
    outlineColor: color.focus,
    outlineOffset: "-2px",
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
    paddingBlock: space.sm,
    paddingInlineStart: space.sm,
    textAlign: "start",
    transform: {
      ":active": { default: "scale(0.98)", [media.reducedMotion]: "none" },
      default: "none",
    },
    transitionDuration: motion.fast,
    transitionProperty: "transform",
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
    outlineColor: color.focus,
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
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
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

/** Height the mini player covers, kept clear at the bottom of screens. */
export const MINI_PLAYER_INSET = "4.5rem";

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
  <div {...stylex.props(styles.dock)}>
    <div {...stylex.props(styles.bar)}>
      <button
        type="button"
        aria-label={`Open player: ${recording.title}`}
        onClick={onExpand}
        {...stylex.props(styles.open)}
      >
        <Cover url={recording.sourceUrl} size="mini" />
        <span {...stylex.props(styles.text)}>
          <span {...stylex.props(styles.title)}>{recording.title}</span>
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
        {...stylex.props(styles.seek)}
      >
        <ForwardIcon />
      </SeekButton>
    </div>
  </div>
);
