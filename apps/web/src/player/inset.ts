import { size } from "@dyslexia/ui/tokens.stylex";

import { useNowPlaying } from "../lib/now-playing";

/** Space screens keep clear for the tab bar, and the mini player atop it. */
export const useBottomInset = () =>
  useNowPlaying().recording
    ? `calc(${size.tabBar} + ${size.miniPlayer})`
    : size.tabBar;
