import {
  BackIcon,
  coverTint,
  ForwardIcon,
  IconButton,
  PauseIcon,
  PlayIcon,
  ReadAlong,
  ReadAlongCard,
  recipes,
  Sheet,
} from "@dyslexia/ui";
import { color, font, radius, size, space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { SeekButton, Time } from "@videojs/react";

import { readAlong, stopReadingAlong } from "../lib/now-playing";
import type { Recording } from "../lib/recording";
import {
  playFrom,
  useReadAlongItems,
  useTranscript,
  useVoicePosition,
} from "../lib/transcript";
import type { PlaybackView } from "./player";

const styles = stylex.create({
  bar: {
    alignItems: "center",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    paddingInline: space.lg,
  },
  controls: { alignItems: "center", display: "flex", gap: space.xs },
  // A plain glyph, as in the full player.
  seek: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radius.full,
    borderStyle: "none",
    color: color.label,
    display: "flex",
    fontSize: "1.5rem",
    height: size.touch,
    justifyContent: "center",
    opacity: { ":active": 0.5, ":disabled": 0.35, default: 1 },
    width: size.touch,
  },
  time: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    fontVariantNumeric: "tabular-nums",
  },
  timeEnd: { justifySelf: "end" },
});

/** Play, pause, and skip, in a capsule under the text. */
const Controls = ({ view }: { view: PlaybackView }) => (
  <div {...stylex.props(recipes.bottomBar, styles.bar)}>
    <span {...stylex.props(styles.time)}>
      <Time.Value type="current" />
    </span>
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
    <span {...stylex.props(styles.time, styles.timeEnd)}>
      <Time.Value type="remaining" negativeSign="−" />
    </span>
  </div>
);

/**
 * The text in the full player: a glimpse of what the voice is saying, and,
 * over the player, the whole text to read along with it. Narrations made
 * before transcripts show nothing.
 */
export const ReadAlongPanel = ({
  open,
  readingAlong,
  recording,
  view,
}: {
  /** Whether the full player is open, so the text follows the voice. */
  open: boolean;
  readingAlong: boolean;
  recording: Recording;
  view: PlaybackView;
}) => {
  const state = useTranscript(recording.transcriptUrl);
  const transcript = state?.status === "ready" ? state.transcript : undefined;
  const items = useReadAlongItems(transcript);
  const position = useVoicePosition(transcript, open);
  if (!state) {
    return null;
  }
  return (
    <>
      <ReadAlongCard
        status={state.status}
        items={items}
        position={position}
        onOpen={readAlong}
        onRetry={() => state.status === "failed" && state.retry()}
      />
      {transcript && (
        <Sheet
          open={open && readingAlong}
          onClose={stopReadingAlong}
          title={recording.title}
          tint={coverTint(recording.artist)}
        >
          <ReadAlong
            items={items}
            position={position}
            onSeek={(item) => playFrom(transcript, item)}
            controls={<Controls view={view} />}
          />
        </Sheet>
      )}
    </>
  );
};
