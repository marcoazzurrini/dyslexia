import { PLAYBACK_RATES } from "@dyslexia/playback";
import {
  BackIcon,
  Button,
  Cover,
  coverTint,
  ExternalIcon,
  ForwardIcon,
  IconButton,
  Notice,
  PauseIcon,
  PlayIcon,
  recipes,
  SegmentedControl,
  Sheet,
  Text,
  VisuallyHidden,
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
import { SeekButton, Time, TimeSlider } from "@videojs/react";

import type { Recording } from "../lib/recording";
import { coverOf } from "../lib/recording";
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
    gap: space.huge,
    justifyContent: "center",
  },
  cover: {
    borderRadius: "1.25rem",
    boxShadow: "0 14px 36px rgb(0 0 0 / 0.24), 0 2px 6px rgb(0 0 0 / 0.12)",
    display: "block",
    marginInline: "auto",
    maxWidth: "17rem",
    overflow: "hidden",
    transformOrigin: "50% 50%",
    transitionDuration: motion.slow,
    transitionProperty: "transform, box-shadow",
    transitionTimingFunction: motion.spring,
    // Smaller on short screens, so the controls stay in view.
    width: "min(78%, 38vh)",
  },
  // As in Podcasts, the cover steps back while paused.
  coverPaused: {
    boxShadow: "0 6px 18px rgb(0 0 0 / 0.16), 0 1px 3px rgb(0 0 0 / 0.1)",
    transform: { default: "scale(0.84)", [media.reducedMotion]: "none" },
  },
  // Room for the cover to grow back when playback starts.
  coverStage: { paddingBlock: space.sm },
  fill: {
    backgroundColor: color.label,
    width: "var(--media-slider-fill)",
  },
  heading: {
    alignItems: "flex-start",
    display: "flex",
    flexDirection: "column",
    gap: space.xxs,
  },
  play: { fontSize: "2.75rem", height: "5rem", width: "5rem" },
  remaining: {
    color: color.label,
    fontSize: font.body,
    fontWeight: 600,
  },
  seek: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radius.full,
    borderStyle: "none",
    color: color.label,
    display: "flex",
    fontSize: "2rem",
    height: "3.5rem",
    justifyContent: "center",
    opacity: { ":active": 0.5, ":disabled": 0.35, default: 1 },
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
    fontSize: font.body,
    gap: space.xs,
    marginBlock: `calc((${size.touch} - 1.5em) / -2)`,
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
      boxShadow: "0 1px 4px rgb(0 0 0 / 0.2)",
      content: "''",
      height: "12px",
      // Hidden at rest, as in Podcasts; it grows under the finger.
      transform: {
        default: "scale(0)",
        [stylex.when.ancestor("[data-dragging]")]: "scale(1.4)",
        [stylex.when.ancestor(":focus-visible")]: "scale(1)",
      },
      transitionDuration: motion.fast,
      transitionProperty: "transform",
      width: "12px",
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
  // Tucked under the track, inside the slider's touch area.
  times: {
    alignItems: "baseline",
    color: color.secondaryLabel,
    display: "flex",
    fontSize: font.footnote,
    fontVariantNumeric: "tabular-nums",
    justifyContent: "space-between",
    marginTop: "-0.75rem",
  },
  track: {
    backgroundColor: color.fillPressed,
    borderRadius: radius.full,
    height: "5px",
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
  <Sheet
    open={open}
    onClose={onClose}
    title="Now playing"
    hideTitle
    tint={coverTint(recording.artist)}
  >
    <div {...stylex.props(styles.coverStage)}>
      <span
        {...stylex.props(
          styles.cover,
          view.status !== "playing" && styles.coverPaused
        )}
      >
        <Cover {...coverOf(recording.sourceUrl)} />
      </span>
    </div>
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
        {recording.artist}
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
        {...stylex.props(styles.slider, stylex.defaultMarker())}
      >
        <TimeSlider.Track {...stylex.props(styles.track)}>
          <TimeSlider.Buffer {...stylex.props(styles.bar, styles.buffer)} />
          <TimeSlider.Fill {...stylex.props(styles.bar, styles.fill)} />
        </TimeSlider.Track>
        <TimeSlider.Thumb {...stylex.props(styles.thumb)} />
      </TimeSlider.Root>
      <div {...stylex.props(styles.times)}>
        <Time.Value type="current" />
        {/* Read at a glance, so larger than the time played. */}
        <span {...stylex.props(styles.remaining)}>
          <Time.Value type="remaining" negativeSign="−" />
        </span>
      </div>
    </div>

    <div {...stylex.props(styles.controls)}>
      <SeekButton
        seconds={-15}
        label="seek back 15 seconds"
        disabled={!view.canSeek}
        {...stylex.props(recipes.focusRing, styles.seek)}
      >
        <BackIcon />
      </SeekButton>
      <IconButton
        label={view.status === "playing" ? "pause" : "play"}
        icon={view.status === "playing" ? <PauseIcon /> : <PlayIcon />}
        variant="plain"
        size="large"
        style={styles.play}
        onClick={view.handleToggle}
      />
      <SeekButton
        seconds={15}
        label="seek forward 15 seconds"
        disabled={!view.canSeek}
        {...stylex.props(recipes.focusRing, styles.seek)}
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
