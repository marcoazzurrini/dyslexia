import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useNarrations } from "../components/narrations-provider";
import { useListening } from "../lib/listening";
import { useBottomInset } from "../player/inset";
import { HomeScreen } from "../screens/home-screen";

const Home = () => {
  const library = useNarrations();
  const listeningOf = useListening();
  // The greeting follows the time of day when the app comes back from the
  // background, which an installed app may stay in for hours.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return (
    <HomeScreen
      narrations={library.narrations}
      error={library.loadError}
      listeningOf={listeningOf}
      now={now}
      bottomInset={useBottomInset()}
      onReload={library.handleReload}
      onAdd={library.handleAdd}
      onPlay={library.handlePlay}
      onOpenFailed={library.handleOpenFailed}
    />
  );
};

export const Route = createFileRoute("/")({ component: Home });
