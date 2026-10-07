import { createPlayer } from "@videojs/react";
import { Audio, audioFeatures } from "@videojs/react/audio";
import { useCallback, useEffect, useRef, useState } from "react";

import { collapse, expand, useNowPlaying } from "../lib/now-playing";
import { connectPlayback } from "../lib/playback";
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

const usePlayback = (recording: Recording) => {
  const player = usePlayer();
  const paused = usePlayer((state) => state.paused);
  const waiting = usePlayer((state) => state.waiting);
  const ended = usePlayer((state) => state.ended);
  const duration = usePlayer((state) => state.duration);
  const mediaError = usePlayer((state) => state.error);
  const [playError, setPlayError] = useState(false);
  const [rate, setRate] = useState(1);
  const [source, setSource] = useState<string>();
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackRef = useRef<ReturnType<typeof connectPlayback> | null>(null);
  const canSeek = Number.isFinite(duration) && duration > 0 && !mediaError;

  const play = useCallback(async () => {
    setPlayError(false);
    try {
      await player.state.play();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setPlayError(true);
      }
    }
  }, [player]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }
    const playback = connectPlayback(
      audioRef.current,
      { onRate: setRate, play },
      recording
    );
    playbackRef.current = playback;
    // Start loading only after mounting, with persistence connected, so a
    // saved position is restored before playback can begin.
    setSource(recording.audioUrl);
    return () => {
      playback.dispose();
      playbackRef.current = null;
    };
  }, [recording, play]);

  let status: PlaybackStatus = "paused";
  if (!canSeek || waiting) {
    status = "loading";
  } else if (ended) {
    status = "ended";
  } else if (!paused) {
    status = "playing";
  }

  const view: PlaybackView = {
    canSeek,
    failed: Boolean(mediaError) || playError,
    handleRateChange: (value) => player.state.setPlaybackRate(value),
    handleRetry: () => playbackRef.current?.retry(),
    handleToggle: () => {
      if (paused) {
        void play();
      } else {
        player.state.pause();
      }
    },
    rate,
    status,
  };
  return { audioRef, source, view };
};

const Session = ({
  expanded,
  recording,
}: {
  expanded: boolean;
  recording: Recording;
}) => {
  const { audioRef, source, view } = usePlayback(recording);
  return (
    <>
      <Audio ref={audioRef} src={source} preload="metadata" />
      {/* The sheet covers the bar, so only one set of controls exists. */}
      {!expanded && (
        <MiniPlayer recording={recording} view={view} onExpand={expand} />
      )}
      <NowPlaying
        open={expanded}
        onClose={collapse}
        recording={recording}
        view={view}
      />
    </>
  );
};

/**
 * The app's one audio player. It stays mounted across navigation, so
 * playback never restarts when the screen changes.
 */
export const Player = () => {
  const { expanded, recording } = useNowPlaying();
  if (!recording) {
    return null;
  }
  return (
    <PlayerProvider key={`${recording.id}:${recording.version}`}>
      <Session expanded={expanded} recording={recording} />
    </PlayerProvider>
  );
};
