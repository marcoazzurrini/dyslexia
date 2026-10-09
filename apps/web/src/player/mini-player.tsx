import {
  ActivityIndicator,
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
import { Time } from "@videojs/react";

import type { Recording } from "../lib/recording";
import { Artwork } from "./artwork";
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
    borderRadius: radius.full,
    boxShadow: `inset 0 0.5px 0 ${color.glassEdge}, 0 8px 30px rgb(0 0 0 / 0.16)`,
    display: "flex",
    gap: space.xs,
    marginInline: "auto",
    maxWidth: size.dock,
    minHeight: "3.75rem",
    paddingInlineEnd: space.sm,
    pointerEvents: "auto",
  },
  // Floats just above the tab bar.
  dock: {
    bottom: `calc(max(${space.sm}, env(safe-area-inset-bottom)) + ${size.tabBar} + ${space.sm})`,
    insetInline: 0,
    paddingInline: `max(${space.md}, env(safe-area-inset-left))`,
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
    borderRadius: radius.full,
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
        <Artwork size="small" />
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
    </div>
  </div>
);
