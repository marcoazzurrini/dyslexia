import { ARTICLE } from "./article";

const validDuration = (audio: HTMLAudioElement) =>
  Number.isFinite(audio.duration) && audio.duration > 0;

export const seekAudio = (audio: HTMLAudioElement, position: number) => {
  if (!validDuration(audio) || !Number.isFinite(position)) {
    return;
  }
  audio.currentTime = Math.min(audio.duration, Math.max(0, position));
};

export const connectMediaSession = (
  audio: HTMLAudioElement,
  play: () => void
) => {
  // Some Safari versions expose Audio Session separately from Media Session.
  try {
    // SAFETY: This intersection only describes an optional browser extension;
    // presence is checked before use, and unsupported setters are caught.
    const browser = navigator as Navigator & {
      audioSession?: { type: string };
    };
    if (browser.audioSession) {
      browser.audioSession.type = "playback";
    }
  } catch {
    // Audio Session is an optional enhancement.
  }

  const session = navigator.mediaSession;
  const registered: MediaSessionAction[] = [];

  if (session) {
    try {
      if (typeof MediaMetadata !== "undefined") {
        session.metadata = new MediaMetadata({
          artist: ARTICLE.author,
          artwork: [
            { sizes: "192x192", src: "/icons/icon-192.png", type: "image/png" },
            { sizes: "512x512", src: "/icons/icon-512.png", type: "image/png" },
          ],
          title: ARTICLE.title,
        });
      }
    } catch {
      // Metadata support must not determine whether audio can play.
    }

    const skip = (direction: number, offset = 15) => {
      if (Number.isFinite(offset) && offset > 0) {
        seekAudio(audio, audio.currentTime + direction * offset);
      }
    };
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["pause", () => audio.pause()],
      ["play", play],
      ["seekbackward", ({ seekOffset }) => skip(-1, seekOffset)],
      ["seekforward", ({ seekOffset }) => skip(1, seekOffset)],
      [
        "seekto",
        ({ seekTime }) => {
          if (seekTime !== undefined) {
            seekAudio(audio, seekTime);
          }
        },
      ],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
        registered.push(action);
      } catch {
        // Each action has independent support, notably on iOS.
      }
    }
  }

  const update = () => {
    if (!session) {
      return;
    }
    try {
      session.playbackState = audio.paused ? "paused" : "playing";
    } catch {
      // Playback state is optional.
    }
    if (
      !validDuration(audio) ||
      !Number.isFinite(audio.currentTime) ||
      audio.currentTime < 0 ||
      !Number.isFinite(audio.playbackRate) ||
      audio.playbackRate <= 0
    ) {
      return;
    }
    try {
      session.setPositionState?.({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration),
      });
    } catch {
      // Older browsers may expose this method without implementing it.
    }
  };

  const dispose = () => {
    for (const action of registered) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // Unsupported cleanup must not interrupt the remaining handlers.
      }
    }
  };

  return { dispose, update };
};
