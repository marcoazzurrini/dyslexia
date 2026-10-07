import { useNowPlaying } from "../lib/now-playing";
import { MINI_PLAYER_INSET } from "./mini-player";

/** Space screens keep clear for the mini player, when it shows. */
export const usePlayerInset = () =>
  useNowPlaying().recording ? MINI_PLAYER_INSET : undefined;
