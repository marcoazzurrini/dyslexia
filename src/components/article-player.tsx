import type { MediaController as MediaControllerElement } from "media-chrome";
import {
  MediaController,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
} from "media-chrome/react";
import { useEffect, useRef, useState } from "react";

import { ARTICLE } from "../lib/article";
import type { PlaybackStatus } from "../lib/playback";
import { connectPlayback, PLAYBACK_RATES } from "../lib/playback";

const STATUS_TEXT: Record<PlaybackStatus, string> = {
  ended: "Finished. Play again whenever you like.",
  error: "Audio could not play. Check your connection, then retry.",
  loading: "Loading audio…",
  paused:
    "Paused. Your place is saved on this device when storage is available.",
  playing: "Playing",
  ready: "Ready when you are. Press Play to listen.",
};

export const ArticlePlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controllerRef = useRef<MediaControllerElement>(null);
  const playbackRef = useRef<ReturnType<typeof connectPlayback> | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("loading");
  const [rate, setRate] = useState(1);
  const [canSeek, setCanSeek] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    const controller = controllerRef.current;
    if (!audio || !controller) {
      return;
    }
    const playback = connectPlayback(audio, {
      onRate: setRate,
      onReady: setCanSeek,
      onStatus: setStatus,
    });
    playbackRef.current = playback;
    const playRequest = (event: Event) => {
      // Handle rejected play promises ourselves instead of the default store.
      event.stopImmediatePropagation();
      playback.play();
    };
    controller.addEventListener("mediaplayrequest", playRequest, true);
    return () => {
      controller.removeEventListener("mediaplayrequest", playRequest, true);
      playback.dispose();
      playbackRef.current = null;
    };
  }, []);

  return (
    <div className="player-shell">
      <section className="panel player" aria-labelledby="player-title">
        <h2 id="player-title">Listen to the article</h2>
        <p className="player-credit">Full narration · {ARTICLE.author}</p>
        <MediaController
          ref={controllerRef}
          audio
          noHotkeys
          noMutedPref
          noVolumePref
        >
          {/* The source article is linked above; no timed captions exist for this narration. */}
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            ref={audioRef}
            slot="media"
            src={ARTICLE.audioUrl}
            preload="metadata"
          />
          <div className="player-timeline">
            <span>Position</span>
            <MediaTimeDisplay showDuration />
          </div>
          <MediaTimeRange aria-disabled={canSeek ? undefined : true} />
          <div className="player-controls">
            <MediaSeekBackwardButton seekOffset={15} disabled={!canSeek}>
              <span slot="icon">−15s</span>
            </MediaSeekBackwardButton>
            <MediaPlayButton className="play-button">
              <span slot="play">Play</span>
              <span slot="pause">Pause</span>
            </MediaPlayButton>
            <MediaSeekForwardButton seekOffset={15} disabled={!canSeek}>
              <span slot="icon">+15s</span>
            </MediaSeekForwardButton>
            <div className="speed-control">
              <label htmlFor="playback-rate">Speed</label>
              <select
                id="playback-rate"
                disabled={!canSeek}
                value={rate}
                onChange={(event) => {
                  if (audioRef.current) {
                    audioRef.current.playbackRate = Number(event.target.value);
                  }
                }}
              >
                {PLAYBACK_RATES.map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </div>
          </div>
        </MediaController>
        {status === "error" ? (
          <div className="player-error">
            <p role="alert">{STATUS_TEXT.error}</p>
            <button type="button" onClick={() => playbackRef.current?.retry()}>
              Retry playback
            </button>
          </div>
        ) : (
          <output className="player-status">{STATUS_TEXT[status]}</output>
        )}
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
  );
};
