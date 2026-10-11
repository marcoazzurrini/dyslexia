import { positionAt, TranscriptSchema } from "@dyslexia/transcript";
import type { Position, Transcript } from "@dyslexia/transcript";
import type { ReadAlongItem } from "@dyslexia/ui";
import { Schema } from "effect";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { playback } from "./now-playing";

/** A transcript from its JSON, checked. */
export const decodeTranscript = Schema.decodeUnknownSync(TranscriptSchema);

export type TranscriptState =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly retry: () => void }
  | { readonly status: "ready"; readonly transcript: Transcript };

type Loaded =
  | { readonly status: "loading" | "failed" }
  | { readonly status: "ready"; readonly transcript: Transcript };

// A transcript never changes, so each is fetched once per visit; one that
// failed is fetched again when the listener asks.
const loaded = new Map<string, Loaded>();
const listeners = new Set<() => void>();

const settle = (url: string, state: Loaded) => {
  loaded.set(url, state);
  for (const listener of listeners) {
    listener();
  }
};

const load = async (url: string) => {
  settle(url, { status: "loading" });
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`The text answered ${response.status}`);
    }
    settle(url, {
      status: "ready",
      transcript: decodeTranscript(await response.json()),
    });
  } catch {
    settle(url, { status: "failed" });
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Loads the transcript at `url`, if there is one. */
export const useTranscript = (
  url: string | undefined
): TranscriptState | undefined => {
  const state = useSyncExternalStore(
    subscribe,
    () => (url ? loaded.get(url) : undefined),
    () => null
  );
  useEffect(() => {
    if (url && !loaded.has(url)) {
      void load(url);
    }
  }, [url]);
  if (!url) {
    return undefined;
  }
  if (state?.status === "ready") {
    return state;
  }
  if (state?.status === "failed") {
    return {
      retry: () => {
        void load(url);
      },
      status: "failed",
    };
  }
  return { status: "loading" };
};

/**
 * Where the voice is in `transcript`, following the audio frame by frame
 * while `active`.
 */
export const useVoicePosition = (
  transcript: Transcript | undefined,
  active: boolean
): Position | undefined => {
  const [position, setPosition] = useState<Position>();
  useEffect(() => {
    if (!transcript || !active) {
      return;
    }
    let frame = 0;
    let last: Position | undefined;
    const follow = () => {
      const next = positionAt(transcript, playback.position());
      if (next?.item !== last?.item || next?.word !== last?.word) {
        last = next;
        setPosition(next);
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [transcript, active]);
  return transcript ? position : undefined;
};

/** The transcript's items, as the read-along view shows them. */
export const readAlongItemsOf = (transcript: Transcript): ReadAlongItem[] =>
  transcript.items.map((item): ReadAlongItem => {
    if (item.kind !== "visual") {
      return item;
    }
    const said = item.say !== "";
    const { visual } = item;
    switch (visual.kind) {
      case "image": {
        return { alt: visual.alt, kind: "picture", said, src: visual.src };
      }
      case "code": {
        return { code: visual.code, kind: "code", said };
      }
      default: {
        return { ...visual, said };
      }
    }
  });

/** `readAlongItemsOf`, worked out once for each transcript. */
export const useReadAlongItems = (transcript: Transcript | undefined) =>
  useMemo(() => (transcript ? readAlongItemsOf(transcript) : []), [transcript]);

/** Plays from where the voice starts an item. Call it during a tap. */
export const playFrom = (transcript: Transcript, item: number) => {
  const start = transcript.items[item]?.start;
  if (start === undefined) {
    return;
  }
  playback.seek(start);
  if (playback.getSnapshot().paused) {
    playback.resume();
  }
};
