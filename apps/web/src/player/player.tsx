import { createPlayer } from "@videojs/react";
import { Audio, audioFeatures } from "@videojs/react/audio";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { collapse, expand, playback, useNowPlaying } from "../lib/now-playing";
import type { Recording } from "../lib/recording";
import { MiniPlayer } from "./mini-player";
import { NowPlaying } from "./now-playing";

const { Player: PlayerProvider, usePlayer } = createPlayer({
  features: audioFeatures,
});

export type PlaybackStatus = "loading" | "paused" | "playing" | "ended";

/** What the player shows, derived from the media state. */
export interface PlaybackView {
  readonly status: PlaybackStatus;
  readonly canSeek: boolean;
  /** Audio failed to load or play; offer a retry. */
  readonly failed: boolean;
  readonly rate: number;
  readonly handleToggle: () => void;
  readonly handleRetry: () => void;
  readonly handleRateChange: (rate: number) => void;
}

const usePlayback = (): PlaybackView => {
  const paused = usePlayer((state) => state.paused);
  const waiting = usePlayer((state) => state.waiting);
  const ended = usePlayer((state) => state.ended);
  const duration = usePlayer((state) => state.duration);
  const mediaError = usePlayer((state) => state.error);
  const { failed, rate } = useNowPlaying();
  const canSeek = Number.isFinite(duration) && duration > 0 && !mediaError;

  let status: PlaybackStatus = "paused";
  if (!canSeek || waiting) {
    status = "loading";
  } else if (ended) {
    status = "ended";
  } else if (!paused) {
    status = "playing";
  }

  return {
    canSeek,
    failed: Boolean(mediaError) || failed,
    handleRateChange: playback.setRate,
    handleRetry: playback.retry,
    handleToggle: paused ? playback.resume : playback.pause,
    rate,
    status,
  };
};

const FullPlayer = ({
  expanded,
  readingAlong,
  recording,
}: {
  expanded: boolean;
  readingAlong: boolean;
  recording: Recording;
}) => (
  <NowPlaying
    open={expanded}
    onClose={collapse}
    readingAlong={readingAlong}
    recording={recording}
    view={usePlayback()}
  />
);

const MiniPlayerControls = ({
  expanded,
  recording,
}: {
  expanded: boolean;
  recording: Recording;
}) => (
  // The sheet covers the bar, so only one set of controls is in reach.
  <MiniPlayer
    hidden={expanded}
    recording={recording}
    view={usePlayback()}
    onExpand={expand}
  />
);

/**
 * The mini player, for the tab bar's top row, while a recording is loaded.
 * It must sit inside the `Player`.
 */
export const MiniPlayerSlot = () => {
  const { expanded, recording } = useNowPlaying();
  return recording ? (
    <MiniPlayerControls expanded={expanded} recording={recording} />
  ) : null;
};

/** The app's one audio element, handed to the player. */
const AudioElement = () => {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => (ref.current ? playback.attach(ref.current) : undefined), []);
  return <Audio ref={ref} preload="metadata" />;
};

/**
 * The app's one audio player, around the screens and the tab bar that holds
 * its `MiniPlayerSlot`. It stays mounted across navigation, so playback
 * never restarts when the screen changes.
 */
export const Player = ({ children }: { children?: ReactNode }) => {
  const { expanded, readingAlong, recording } = useNowPlaying();
  return (
    <PlayerProvider>
      <AudioElement />
      {children}
      {recording && (
        <FullPlayer
          expanded={expanded}
          readingAlong={readingAlong}
          recording={recording}
        />
      )}
    </PlayerProvider>
  );
};
