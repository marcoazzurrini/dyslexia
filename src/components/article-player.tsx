import {
  Container,
  createPlayer,
  SeekButton,
  Time,
  TimeSlider,
} from "@videojs/react";
import { Audio, audioFeatures } from "@videojs/react/audio";
import { useCallback, useEffect, useRef, useState } from "react";

import { ARTICLE } from "../lib/article";
import { connectPlayback, PLAYBACK_RATES } from "../lib/playback";

const { Player, usePlayer } = createPlayer({ features: audioFeatures });

const PlaybackControls = () => {
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
    const playback = connectPlayback(audioRef.current, {
      onRate: setRate,
      play,
    });
    playbackRef.current = playback;
    // Suspense can create media before committing it to the document. Start
    // loading only after mounting, with the player and persistence connected.
    setSource(ARTICLE.audioUrl);
    return () => {
      playback.dispose();
      playbackRef.current = null;
    };
  }, [play]);

  let status =
    "Paused. Your place is saved on this device when storage is available.";
  if (!canSeek || waiting) {
    status = "Loading audio…";
  } else if (ended) {
    status = "Finished. Play again whenever you like.";
  } else if (!paused) {
    status = "Playing";
  }

  return (
    <>
      <Container className="audio-player">
        <Audio ref={audioRef} src={source} preload="metadata" />
        <div className="player-timeline">
          <span>Position</span>
          <Time.Group>
            <Time.Value type="current" />
            <Time.Separator />
            <Time.Value type="duration" />
          </Time.Group>
        </div>
        <TimeSlider.Root
          className="player-seek"
          label="seek"
          disabled={!canSeek}
        >
          <TimeSlider.Track className="player-seek-track">
            <TimeSlider.Buffer className="player-seek-buffer" />
            <TimeSlider.Fill className="player-seek-fill" />
          </TimeSlider.Track>
          <TimeSlider.Thumb className="player-seek-thumb" />
        </TimeSlider.Root>
        <div className="player-controls">
          <SeekButton
            seconds={-15}
            label="seek back 15 seconds"
            disabled={!canSeek}
          >
            −15s
          </SeekButton>
          <button
            type="button"
            className="play-button"
            aria-label={paused ? "play" : "pause"}
            onClick={() => {
              if (paused) {
                play();
              } else {
                player.state.pause();
              }
            }}
          >
            {paused ? "Play" : "Pause"}
          </button>
          <SeekButton
            seconds={15}
            label="seek forward 15 seconds"
            disabled={!canSeek}
          >
            +15s
          </SeekButton>
          <div className="speed-control">
            <label htmlFor="playback-rate">Speed</label>
            <select
              id="playback-rate"
              disabled={!canSeek}
              value={rate}
              onChange={(event) =>
                player.state.setPlaybackRate(Number(event.target.value))
              }
            >
              {PLAYBACK_RATES.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </div>
        </div>
      </Container>
      {mediaError || playError ? (
        <div className="player-error">
          <p role="alert">
            Audio could not play. Check your connection, then retry.
          </p>
          <button type="button" onClick={() => playbackRef.current?.retry()}>
            Retry playback
          </button>
        </div>
      ) : (
        <output className="player-status">{status}</output>
      )}
    </>
  );
};

export const ArticlePlayer = () => (
  <Player>
    <div className="player-shell">
      <section className="panel player" aria-labelledby="player-title">
        <h2 id="player-title">Listen to the article</h2>
        <p className="player-credit">Full narration · {ARTICLE.author}</p>
        <PlaybackControls />
        <noscript>Enable JavaScript to use the audio player.</noscript>
      </section>
      <section className="install-help" aria-labelledby="install-title">
        <h2 id="install-title">Add to your Home Screen</h2>
        <p>
          On iPhone, open this page in Safari. Tap Share, then Add to Home
          Screen.
        </p>
        <p className="small-text">
          Listening needs an internet connection. Offline listening is not
          available. Your saved place stays in this browser, not across devices.
        </p>
      </section>
    </div>
  </Player>
);
