import type { Track } from "./track.ts";

const validDuration = (audio: HTMLAudioElement) =>
  Number.isFinite(audio.duration) && audio.duration > 0;

const seekAudio = (audio: HTMLAudioElement, position: number) => {
  if (!validDuration(audio) || !Number.isFinite(position)) {
    return;
  }
  audio.currentTime = Math.min(audio.duration, Math.max(0, position));
};

/**
 * Shows a track on the lock screen and in Control Center, and answers
 * their buttons, until disposed.
 */
export const connectMediaSession = (
  audio: HTMLAudioElement,
  play: () => void,
  { artist, title }: Pick<Track, "artist" | "title">,
  artwork: readonly MediaImage[]
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
          artist,
          artwork: [...artwork],
          title,
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
