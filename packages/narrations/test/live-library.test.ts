import "./support/workers.ts";
import { afterEach, describe, expect, test } from "bun:test";

import { createLibrary } from "../src/client.ts";
import type { LiveLibrary } from "../src/client.ts";
import { apiSetup, ORIGIN } from "./support/api.ts";
import { routeFetch } from "./support/network.ts";

// A page the test can hide and show.
const page: EventTarget & { visibilityState: DocumentVisibilityState } =
  Object.assign(new EventTarget(), { visibilityState: "visible" as const });
Object.assign(globalThis, { document: page });

const setVisibility = (visibility: DocumentVisibilityState) => {
  page.visibilityState = visibility;
  page.dispatchEvent(new Event("visibilitychange"));
};

/** Sends the library's requests to `server`, as a browser on this site would. */
const serve = (server: (request: Request) => Promise<Response>) => {
  routeFetch((request) => {
    if (request.method !== "GET") {
      request.headers.set("Origin", ORIGIN);
    }
    return server(request);
  });
};

/** Waits until `check` passes, as the library loads in the background. */
const until = async (check: () => boolean) => {
  for (let tries = 0; !check(); tries += 1) {
    if (tries > 2000) {
      throw new Error("Timed out waiting for the library");
    }
    // eslint-disable-next-line no-await-in-loop -- Polls until it passes.
    await Bun.sleep(2);
  }
};

const idsOf = (library: LiveLibrary) =>
  library.getSnapshot().narrations?.map((narration) => narration.id);

let disconnect = () => {
  // Nothing is connected yet.
};
const connect = (library: LiveLibrary) => {
  disconnect = library.connect();
  return library;
};

afterEach(() => {
  disconnect();
  setVisibility("visible");
});

describe("the live library", () => {
  test("loads the narrations when connected", async () => {
    const api = apiSetup();
    const ready = await api.seed({ durationSeconds: 60, state: "ready" });
    serve(api.handle);
    const library = connect(createLibrary());
    expect(library.getSnapshot().narrations).toBeNull();
    await until(() => library.getSnapshot().narrations !== null);
    expect(idsOf(library)).toEqual([ready.id]);
  });

  test("a list read before a removal never brings it back", async () => {
    const api = apiSetup();
    const ready = await api.seed({ durationSeconds: 60, state: "ready" });
    let hold: Promise<null> | null = null;
    serve(async (request) => {
      const response = await api.handle(request);
      // Answers this list only after the removal, as a slow network would.
      await hold;
      return response;
    });
    const library = connect(createLibrary());
    await until(() => library.getSnapshot().narrations !== null);

    const gate = Promise.withResolvers<null>();
    hold = gate.promise;
    library.reload();
    await Bun.sleep(5);
    hold = null;
    await library.remove(ready.id);
    expect(idsOf(library)).toEqual([]);

    gate.resolve(null);
    await Bun.sleep(20);
    expect(idsOf(library)).toEqual([]);
  });

  test("brings a narration back when the server refuses to remove it", async () => {
    const api = apiSetup();
    const making = await api.seed(
      { stage: "reading", state: "making" },
      { running: true }
    );
    serve(api.handle);
    const library = connect(createLibrary());
    await until(() => library.getSnapshot().narrations !== null);

    const removal = library.remove(making.id);
    expect(idsOf(library)).toEqual([]);
    await expect(removal).rejects.toMatchObject({ kind: "conflict" });
    await until(() => idsOf(library)?.length === 1);
  });

  test("shows a new narration once it is started", async () => {
    const api = apiSetup();
    serve(api.handle);
    const library = connect(createLibrary());
    await until(() => library.getSnapshot().narrations !== null);
    await library.add("https://example.org/article");
    await until(() => idsOf(library)?.length === 1);
    expect(library.getSnapshot().narrations?.[0]).toMatchObject({
      state: "making",
    });
  });

  test("reports a failed load until one succeeds", async () => {
    const api = apiSetup();
    serve(() => Promise.reject(new TypeError("offline")));
    const library = connect(createLibrary());
    await until(() => library.getSnapshot().error !== null);
    expect(library.getSnapshot().error).toMatchObject({ kind: "unavailable" });

    serve(api.handle);
    library.reload();
    expect(library.getSnapshot().error).toBeNull();
    await until(() => library.getSnapshot().narrations !== null);
  });

  test("loads nothing while the page is hidden, and loads when it shows", async () => {
    const api = apiSetup();
    let lists = 0;
    serve((request) => {
      lists += 1;
      return api.handle(request);
    });
    setVisibility("hidden");
    const library = connect(createLibrary());
    await Bun.sleep(10);
    expect(lists).toBe(0);

    setVisibility("visible");
    await until(() => library.getSnapshot().narrations !== null);
    expect(lists).toBe(1);
  });

  test("loads again while a narration is being made", async () => {
    const api = apiSetup();
    await api.seed({ stage: "reading", state: "making" }, { running: true });
    let lists = 0;
    serve((request) => {
      lists += 1;
      return api.handle(request);
    });
    connect(createLibrary());
    await until(() => lists === 2);
  }, 5000);
});
