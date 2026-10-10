// A browser, as far as playback uses one: storage, page events, and an
// audio element the test drives by hand.

const items = new Map<string, string>();

const storage: Pick<Storage, "getItem" | "removeItem" | "setItem" | "clear"> = {
  clear: () => items.clear(),
  getItem: (key) => items.get(key) ?? null,
  removeItem: (key) => {
    items.delete(key);
  },
  setItem: (key, value) => {
    items.set(key, value);
  },
};

Object.assign(globalThis, {
  document: new EventTarget(),
  localStorage: storage,
  window: new EventTarget(),
});

export const resetStorage = () => items.clear();

/** Saves raw JSON, as an earlier visit or version would have. */
export const store = (key: string, json: string) => items.set(key, json);

/**
 * An audio element that loads and plays only when the test says so, as a
 * real one does over a slow connection.
 */
export class FakeAudio extends EventTarget {
  duration = Number.NaN;
  readyState = 0;
  paused = true;
  defaultPlaybackRate = 1;
  preservesPitch = false;
  /** What the next `play()` does: plays, or fails with this error. */
  refusal: DOMException | null = null;
  /** Refuses to seek until data loads, as some engines do. */
  seeksOnlyWithData = false;
  #rate = 1;
  #src = "";
  #time = 0;

  get currentTime() {
    return this.#time;
  }

  set currentTime(time: number) {
    if (this.seeksOnlyWithData && this.readyState < 2) {
      throw new DOMException("Not ready", "InvalidStateError");
    }
    this.#time = time;
  }

  get playbackRate() {
    return this.#rate;
  }

  set playbackRate(rate: number) {
    this.#rate = rate;
    this.emit("ratechange");
  }

  get src() {
    return this.#src;
  }

  set src(src: string) {
    this.#src = src;
    this.load();
  }

  removeAttribute(name: string) {
    if (name === "src") {
      this.#src = "";
    }
  }

  load() {
    this.readyState = 0;
    this.duration = Number.NaN;
    this.#time = 0;
    this.emit("emptied");
  }

  play() {
    if (this.refusal) {
      return Promise.reject(this.refusal);
    }
    this.paused = false;
    this.emit("play");
    return Promise.resolve();
  }

  pause() {
    if (!this.paused) {
      this.paused = true;
      this.emit("pause");
    }
  }

  /** As when the browser learns the audio's length. */
  loadMetadata(duration: number) {
    this.readyState = 1;
    this.duration = duration;
    this.emit("loadedmetadata");
  }

  /** As when the first frame of audio arrives. */
  loadData() {
    this.readyState = 2;
    this.emit("loadeddata");
  }

  /** As while playing. */
  playTo(time: number) {
    this.currentTime = time;
    this.emit("timeupdate");
  }

  emit(type: string) {
    this.dispatchEvent(new Event(type));
  }

  /** Hands it to code that expects a real element. */
  element() {
    // SAFETY: implements every member playback uses; tests would fail on
    // any other use.
    // eslint-disable-next-line anti-slop/no-chained-type-assertions -- A partial stand-in for a platform element.
    return this as unknown as HTMLAudioElement;
  }
}

/** Lets rejected `play()` calls settle. */
export const settle = () => Bun.sleep(0);
