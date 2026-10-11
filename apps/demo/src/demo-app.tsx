import type { Narration } from "@dyslexia/narrations/client";
import { AppTabBar } from "@dyslexia/web/components/app-tab-bar";
import { open, playback, useNowPlaying } from "@dyslexia/web/lib/now-playing";
import { recordingOf } from "@dyslexia/web/lib/recording";
import { useBottomInset } from "@dyslexia/web/player/inset";
import { MiniPlayerSlot, Player } from "@dyslexia/web/player/player";
import { FailedSheet } from "@dyslexia/web/screens/failed-sheet";
import { HomeScreen } from "@dyslexia/web/screens/home-screen";
import type { LibraryFilter } from "@dyslexia/web/screens/library-screen";
import { LibraryScreen } from "@dyslexia/web/screens/library-screen";
import { NarrationOptionsSheet } from "@dyslexia/web/screens/narration-options-sheet";
import { NewNarrationSheet } from "@dyslexia/web/screens/new-narration-sheet";
import { ProfileScreen } from "@dyslexia/web/screens/profile-screen";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { createContext, use, useMemo, useState } from "react";
import { fn } from "storybook/test";

import { listeningOf } from "./fixtures";

type Ready = Extract<Narration, { state: "ready" }>;
type Failed = Extract<Narration, { state: "failed" }>;

interface Demo {
  readonly narrations: readonly Narration[];
  readonly handleAdd: () => void;
  readonly handleOpenFailed: (narration: Failed) => void;
  readonly handleOptions: (narration: Ready) => void;
  readonly handleDelete: (narration: Ready | Failed) => void;
}

const DemoContext = createContext<Demo | null>(null);

const useDemo = () => {
  const demo = use(DemoContext);
  if (!demo) {
    throw new Error("useDemo needs a DemoApp");
  }
  return demo;
};

// Nothing to reload or sign out of; the actions panel shows the press.
const handleReload = fn();
const handleSignOut = fn();

/** What every screen does with a narration, through the real player. */
const usePlaying = () => {
  const { paused, recording } = useNowPlaying();
  return {
    bottomInset: useBottomInset(),
    onListen: (narration: Ready) => playback.play(recordingOf(narration)),
    onOpen: (narration: Ready) => open(recordingOf(narration)),
    onPause: playback.pause,
    playingId: paused ? undefined : recording?.id,
  };
};

const Home = () => {
  const demo = useDemo();
  return (
    <HomeScreen
      {...usePlaying()}
      narrations={demo.narrations}
      listeningOf={listeningOf}
      now={new Date("2026-10-09T19:30:00")}
      onReload={handleReload}
      onAdd={demo.handleAdd}
      onOpenFailed={demo.handleOpenFailed}
    />
  );
};

const Library = () => {
  const demo = useDemo();
  const [filter, setFilter] = useState<LibraryFilter>("all");
  return (
    <LibraryScreen
      {...usePlaying()}
      narrations={demo.narrations}
      filter={filter}
      onFilter={setFilter}
      listeningOf={listeningOf}
      onReload={handleReload}
      onAdd={demo.handleAdd}
      onOpenFailed={demo.handleOpenFailed}
      onOptions={demo.handleOptions}
      onDelete={demo.handleDelete}
    />
  );
};

const Profile = () => (
  <ProfileScreen
    account={{ email: "ada@example.com", name: "Ada Reader" }}
    busy={false}
    bottomInset={useBottomInset()}
    onSignOut={handleSignOut}
  />
);

/** As the app lays out every signed-in screen. */
const Layout = () => (
  <Player>
    <Outlet />
    <AppTabBar accessory={<MiniPlayerSlot />} onAdd={useDemo().handleAdd} />
  </Player>
);

const rootRoute = createRootRoute({ component: Layout });

const routeTree = rootRoute.addChildren([
  createRoute({ component: Home, getParentRoute: () => rootRoute, path: "/" }),
  createRoute({
    component: Library,
    getParentRoute: () => rootRoute,
    path: "/library",
  }),
  createRoute({
    component: Profile,
    getParentRoute: () => rootRoute,
    path: "/profile",
  }),
]);

export type DemoPath = "/" | "/library" | "/profile";

/**
 * The signed-in app on fixture narrations: the tabs switch screens, the
 * play buttons play a short recording, and the sheets open and close.
 * Nothing reaches a server.
 */
export const DemoApp = ({
  narrations: initial,
  path = "/",
}: {
  narrations: readonly Narration[];
  path?: DemoPath;
}) => {
  // eslint-disable-next-line react/hook-use-state -- Created once, never replaced.
  const [router] = useState(() =>
    createRouter({
      history: createMemoryHistory({ initialEntries: [path] }),
      routeTree,
    })
  );
  const [narrations, setNarrations] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState<Failed | null>(null);
  const [options, setOptions] = useState<Ready | null>(null);
  const demo = useMemo<Demo>(() => {
    const handleDelete = (narration: Ready | Failed) => {
      setNarrations((all) => all.filter(({ id }) => id !== narration.id));
      setFailed(null);
      setOptions(null);
    };
    return {
      handleAdd: () => setAdding(true),
      handleDelete,
      handleOpenFailed: setFailed,
      handleOptions: setOptions,
      narrations,
    };
  }, [narrations]);
  return (
    <DemoContext value={demo}>
      <RouterProvider router={router} />
      <NewNarrationSheet
        open={adding}
        busy={false}
        onClose={() => setAdding(false)}
        onSubmit={() => setAdding(false)}
      />
      <FailedSheet
        narration={failed}
        busy={null}
        onClose={() => setFailed(null)}
        onRetry={() => setFailed(null)}
        onRemove={() => {
          if (failed) {
            demo.handleDelete(failed);
          }
        }}
      />
      <NarrationOptionsSheet
        narration={options}
        finished={options ? listeningOf(options).status === "finished" : false}
        onClose={() => setOptions(null)}
        onMarkFinished={() => setOptions(null)}
        onDelete={() => {
          if (options) {
            demo.handleDelete(options);
          }
        }}
      />
    </DemoContext>
  );
};
