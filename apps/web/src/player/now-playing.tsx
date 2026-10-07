import {
  BackIcon,
  Button,
  ExternalIcon,
  ForwardIcon,
  IconButton,
  Notice,
  PauseIcon,
  PlayIcon,
  SegmentedControl,
  Sheet,
  Text,
  VisuallyHidden,
} from "@dyslexia/ui";
import {
  color,
  font,
  motion,
  radius,
  size,
  space,
} from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { SeekButton, Time, TimeSlider } from "@videojs/react";

import { PLAYBACK_RATES } from "../lib/playback";
import type { Recording } from "../lib/recording";
import { siteOf } from "../lib/recording";
import { Artwork } from "./artwork";
import type { PlaybackView } from "./player";

const styles = stylex.create({
  bar: {
    height: "100%",
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: "absolute",
  },
  buffer: {
    backgroundColor: color.fillPressed,
    width: "var(--media-slider-buffer)",
  },
  controls: {
    alignItems: "center",
    display: "flex",
    gap: space.xxxl,
    justifyContent: "center",
  },
  fill: {
    backgroundColor: color.label,
    width: "var(--media-slider-fill)",
  },
  heading: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: space.xs,
    textAlign: "center",
  },
  seek: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radius.full,
    borderStyle: "none",
    color: color.label,
    display: "flex",
    fontSize: "1.9rem",
    height: "3.5rem",
    justifyContent: "center",
    opacity: { ":active": 0.5, ":disabled": 0.35, default: 1 },
    outlineColor: color.focus,
    outlineStyle: { ":focus-visible": "solid", default: "none" },
    outlineWidth: "2px",
    transitionDuration: motion.fast,
    transitionProperty: "opacity",
    width: "3.5rem",
  },
  slider: {
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    height: size.touch,
    position: "relative",
    touchAction: "none",
    width: "100%",
  },
  source: {
    alignItems: "center",
    color: color.accentText,
    display: "inline-flex",
    fontSize: font.subheadline,
    gap: space.xs,
    minHeight: size.touch,
    textDecoration: "none",
  },
  speed: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
  },
  speedLabel: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    fontWeight: 600,
    paddingInline: space.lg,
  },
  status: {
    color: color.secondaryLabel,
    display: "block",
    fontSize: font.footnote,
    textAlign: "center",
  },
  thumb: {
    "::after": {
      backgroundColor: color.label,
      borderRadius: radius.full,
      content: "''",
      height: "14px",
      width: "14px",
    },
    alignItems: "center",
    display: "flex",
    height: size.touch,
    justifyContent: "center",
    left: "var(--media-slider-fill)",
    outlineStyle: "none",
    position: "absolute",
    transform: "translateX(-50%)",
    width: size.touch,
  },
  timeline: { display: "flex", flexDirection: "column" },
  times: {
    color: color.secondaryLabel,
    display: "flex",
    fontSize: font.footnote,
    fontVariantNumeric: "tabular-nums",
    justifyContent: "space-between",
  },
  track: {
    backgroundColor: color.fill,
    borderRadius: radius.full,
    height: "6px",
    insetInline: 0,
    overflow: "hidden",
    position: "absolute",
  },
});

const STATUS_TEXT = {
  ended: "Finished. Play again whenever you like.",
  loading: "Loading audio…",
  paused: "Paused. Your place is saved on this device.",
  playing: "Playing",
} as const;

const RATE_OPTIONS = PLAYBACK_RATES.map((rate) => ({
  label: `${rate}×`,
  value: rate,
}));

/** The full player, in a sheet over the current screen. */
export const NowPlaying = ({
  onClose,
  open,
  recording,
  view,
}: {
  onClose: () => void;
  open: boolean;
  recording: Recording;
  view: PlaybackView;
}) => (
  <Sheet open={open} onClose={onClose} title="Now playing">
    <Artwork size="large" />
    <div {...stylex.props(styles.heading)}>
      <Text as="h3" variant="title2">
        {recording.title}
      </Text>
      <a
        href={recording.sourceUrl}
        target="_blank"
        rel="noreferrer"
        {...stylex.props(styles.source)}
      >
        {siteOf(recording.sourceUrl)}
        <ExternalIcon />
        <VisuallyHidden>
          (opens the original article in a new tab)
        </VisuallyHidden>
      </a>
    </div>

    <div {...stylex.props(styles.timeline)}>
      <TimeSlider.Root
        label="seek"
        disabled={!view.canSeek}
        {...stylex.props(styles.slider)}
      >
        <TimeSlider.Track {...stylex.props(styles.track)}>
          <TimeSlider.Buffer {...stylex.props(styles.bar, styles.buffer)} />
          <TimeSlider.Fill {...stylex.props(styles.bar, styles.fill)} />
        </TimeSlider.Track>
        <TimeSlider.Thumb {...stylex.props(styles.thumb)} />
      </TimeSlider.Root>
      <div {...stylex.props(styles.times)}>
        <Time.Value type="current" />
        <Time.Value type="remaining" negativeSign="−" />
      </div>
    </div>

    <div {...stylex.props(styles.controls)}>
      <SeekButton
        seconds={-15}
        label="seek back 15 seconds"
        disabled={!view.canSeek}
        {...stylex.props(styles.seek)}
      >
        <BackIcon />
      </SeekButton>
      <IconButton
        label={view.status === "playing" ? "pause" : "play"}
        icon={view.status === "playing" ? <PauseIcon /> : <PlayIcon />}
        variant="filled"
        size="large"
        onClick={view.handleToggle}
      />
      <SeekButton
        seconds={15}
        label="seek forward 15 seconds"
        disabled={!view.canSeek}
        {...stylex.props(styles.seek)}
      >
        <ForwardIcon />
      </SeekButton>
    </div>

    <div {...stylex.props(styles.speed)}>
      {/* The control has its own accessible name. */}
      <span aria-hidden="true" {...stylex.props(styles.speedLabel)}>
        Speed
      </span>
      <SegmentedControl
        label="Speed"
        options={RATE_OPTIONS}
        value={view.rate}
        disabled={!view.canSeek}
        onChange={view.handleRateChange}
      />
    </div>

    {view.failed ? (
      <Notice
        tone="danger"
        title="Audio could not play"
        announce
        action={
          <Button variant="tinted" onClick={view.handleRetry}>
            Retry playback
          </Button>
        }
      >
        Check your connection, then retry.
      </Notice>
    ) : (
      <output {...stylex.props(styles.status)}>
        {STATUS_TEXT[view.status]}
      </output>
    )}
  </Sheet>
);
