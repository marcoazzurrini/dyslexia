import { beforeEach, describe, expect, test } from "bun:test";

import { createPlayback } from "../src/index.ts";
import type { Track } from "../src/index.ts";
import { readPlace } from "../src/places.ts";
import { FakeAudio, resetStorage, settle, store } from "./support.ts";

const track = (id: string, duration = 100): Track => ({
  artist: "example.org",
  duration,
  id,
  src: `/audio/${id}.mp3`,
  title: `Track ${id}`,
  version: "1",
});

const placeOf = (id: string) => readPlace(`test:playback:${id}:1`);

const isTrack = (saved: unknown): saved is Track =>
  typeof saved === "object" && saved !== null && "src" in saved;

const setup = () => {
  const playback = createPlayback<Track>({
    isTrack,
    storagePrefix: "test",
  });
  const audio = new FakeAudio();
  const detach = playback.attach(audio.element());
  return { audio, detach, playback };
};

beforeEach(resetStorage);

describe("playback", () => {
  test("starts a track from its saved place, once the audio knows its length", () => {
    store("test:playback:a:1", JSON.stringify({ position: 30, rate: 1.5 }));
    const { audio, playback } = setup();
    playback.load(track("a"));
    expect(audio.src).toBe("/audio/a.mp3");
    expect(audio.currentTime).toBe(0);

    audio.loadMetadata(100);
    expect(audio.currentTime).toBe(30);
    expect(audio.playbackRate).toBe(1.5);
    expect(playback.getSnapshot()).toMatchObject({ paused: true, rate: 1.5 });
  });

  test("never saves over the place before it was restored", () => {
    store("test:playback:a:1", JSON.stringify({ position: 30, rate: 1 }));
    const { audio, playback } = setup();
    playback.load(track("a"));
    audio.emit("timeupdate");
    audio.emit("pause");
    expect(placeOf("a")).toMatchObject({ position: 30 });
  });

  test("waits to seek until the audio accepts it, saving nothing meanwhile", () => {
    store("test:playback:a:1", JSON.stringify({ position: 30, rate: 1 }));
    const { audio, playback } = setup();
    audio.seeksOnlyWithData = true;
    playback.load(track("a"));
    audio.loadMetadata(100);
    audio.emit("pause");
    expect(placeOf("a")).toMatchObject({ position: 30 });

    audio.loadData();
    expect(audio.currentTime).toBe(30);
  });

  test("switching tracks keeps each one's place", () => {
    store("test:playback:a:1", JSON.stringify({ position: 5, rate: 1 }));
    const { audio, playback } = setup();
    playback.play(track("a"));
    audio.loadMetadata(100);
    audio.playTo(40);

    playback.play(track("b"));
    expect(placeOf("a")).toMatchObject({ position: 40 });
    audio.loadMetadata(60);
    expect(audio.currentTime).toBe(0);
    audio.playTo(10);

    playback.play(track("a"));
    expect(placeOf("b")).toMatchObject({ position: 10 });
    expect(placeOf("a")).toMatchObject({ position: 40 });
    audio.loadMetadata(100);
    expect(audio.currentTime).toBe(40);
  });

  test("each track keeps its own speed", () => {
    const { audio, playback } = setup();
    playback.play(track("a"));
    audio.loadMetadata(100);
    playback.setRate(1.5);
    expect(playback.getSnapshot().rate).toBe(1.5);
    expect(placeOf("a")).toMatchObject({ rate: 1.5 });

    playback.play(track("b"));
    expect(playback.getSnapshot().rate).toBe(1);
    playback.play(track("a"));
    audio.loadMetadata(100);
    expect(audio.playbackRate).toBe(1.5);
  });

  test("ignores speeds it does not offer", () => {
    const { audio, playback } = setup();
    playback.play(track("a"));
    audio.loadMetadata(100);
    playback.setRate(3);
    expect(playback.getSnapshot().rate).toBe(1);
  });

  test("reports a play the browser refuses, and retries it", async () => {
    const { audio, playback } = setup();
    audio.refusal = new DOMException("Needs a tap", "NotAllowedError");
    playback.play(track("a"));
    await settle();
    expect(playback.getSnapshot().failed).toBe(true);

    audio.refusal = null;
    playback.retry();
    await settle();
    expect(playback.getSnapshot()).toMatchObject({
      failed: false,
      paused: false,
    });
  });

  test("a play aborted by switching tracks is not a failure", async () => {
    const { audio, playback } = setup();
    audio.refusal = new DOMException("Interrupted", "AbortError");
    playback.play(track("a"));
    await settle();
    expect(playback.getSnapshot().failed).toBe(false);
  });

  test("follows the audio's own pause and play", () => {
    const { audio, playback } = setup();
    playback.play(track("a"));
    expect(playback.getSnapshot().paused).toBe(false);
    // As from the lock screen.
    audio.pause();
    expect(playback.getSnapshot().paused).toBe(true);
  });

  test("marks a track finished, or not started, and moves the audio there", () => {
    const { audio, playback } = setup();
    const a = track("a");
    playback.play(a);
    audio.loadMetadata(100);
    audio.playTo(10);

    playback.markFinished(a, true);
    expect(playback.progressOf(a)).toMatchObject({
      remaining: 0,
      status: "finished",
    });
    expect(audio.currentTime).toBe(100);

    playback.markFinished(a, false);
    expect(playback.progressOf(a).status).toBe("not-started");
    expect(audio.currentTime).toBe(0);
  });

  test("marking a track that is not loaded leaves the audio alone", () => {
    const { audio, playback } = setup();
    playback.play(track("a"));
    audio.loadMetadata(100);
    audio.playTo(10);
    playback.markFinished(track("b", 60), true);
    expect(playback.progressOf(track("b", 60)).status).toBe("finished");
    expect(audio.currentTime).toBe(10);
  });

  test("counts stopping just before the end as finished", () => {
    const { playback } = setup();
    store("test:playback:a:1", JSON.stringify({ position: 97, rate: 1 }));
    store("test:playback:b:1", JSON.stringify({ position: 50, rate: 1 }));
    expect(playback.progressOf(track("a")).status).toBe("finished");
    expect(playback.progressOf(track("b"))).toMatchObject({
      remaining: 50,
      status: "in-progress",
    });
    expect(playback.progressOf(track("c")).status).toBe("not-started");
  });

  test("tells progress listeners about every save", () => {
    const { audio, playback } = setup();
    let saves = 0;
    const unsubscribe = playback.subscribeProgress(() => {
      saves += 1;
    });
    playback.play(track("a"));
    audio.loadMetadata(100);
    audio.pause();
    expect(saves).toBe(1);
    playback.markFinished(track("b"), true);
    expect(saves).toBe(2);
    unsubscribe();
    playback.markFinished(track("b"), false);
    expect(saves).toBe(2);
  });

  test("saves the place when the page hides", () => {
    const { audio, playback } = setup();
    playback.play(track("a"));
    audio.loadMetadata(100);
    audio.playTo(20);
    audio.currentTime = 25;
    window.dispatchEvent(new Event("pagehide"));
    expect(placeOf("a")).toMatchObject({ position: 25 });
  });

  test("brings back the last track on the next visit, until stopped", () => {
    const first = setup();
    first.playback.play(track("a"));
    first.detach();

    const next = setup();
    expect(next.playback.getSnapshot().track).toEqual(track("a"));
    expect(next.audio.src).toBe("/audio/a.mp3");
    expect(next.audio.paused).toBe(true);

    next.playback.stop();
    expect(next.playback.getSnapshot().track).toBeNull();
    expect(next.audio.src).toBe("");
    expect(setup().playback.getSnapshot().track).toBeNull();
  });

  test("forgets a saved track it cannot read", () => {
    store("test:now-playing", JSON.stringify({ id: 1 }));
    const playback = createPlayback<Track>({
      isTrack,
      storagePrefix: "test",
    });
    expect(playback.getSnapshot().track).toBeNull();
  });

  test("loads a track chosen before the audio element exists", () => {
    const playback = createPlayback<Track>({
      isTrack,
      storagePrefix: "test",
    });
    playback.load(track("a"));
    const audio = new FakeAudio();
    playback.attach(audio.element());
    expect(audio.src).toBe("/audio/a.mp3");
  });
});
