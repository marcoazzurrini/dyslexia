import { size } from "@dyslexia/ui/tokens.stylex";

import { useNowPlaying } from "../lib/now-playing";
import { MINI_PLAYER_INSET } from "./mini-player";

/** Space screens keep clear for the tab bar, and the mini player above it. */
export const useBottomInset = () =>
  useNowPlaying().recording
    ? `calc(${size.tabBar} + ${MINI_PLAYER_INSET})`
    : size.tabBar;
