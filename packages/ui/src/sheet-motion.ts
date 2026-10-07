// Physical motion for the sheet, following Apple's fluid interface
// guidance: motion starts from where the panel is, keeps the finger's speed,
// and can be interrupted at any moment.

// A critically damped spring, sampled for the Web Animations API.
export const SPRING =
  "linear(0, 0.227, 0.536, 0.75, 0.873, 0.938, 0.971, 0.986, 0.994, 0.997, 1)";
const SETTLE_MS = 500;

export const reducedMotion = () =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Where a flick would come to rest, as iOS scroll deceleration projects it. */
export const project = (velocity: number, deceleration = 0.998) =>
  ((velocity / 1000) * deceleration) / (1 - deceleration);

/** Resistance past an edge: the further the drag, the less it follows. */
export const rubberband = (distance: number, dimension: number) =>
  (distance * dimension * 0.55) / (dimension + 0.55 * Math.abs(distance));

export const currentY = (element: HTMLElement) =>
  new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;

/**
 * Moves the panel to `to` from wherever it is now, so motion can be
 * interrupted and redirected at any moment.
 */
export const settle = async (
  panel: HTMLElement,
  scrim: HTMLElement,
  to: number,
  velocity = 0
) => {
  const from = currentY(panel);
  const height = Math.max(panel.offsetHeight, 1);
  for (const animation of panel.getAnimations()) {
    animation.cancel();
  }
  panel.style.transform = `translateY(${to}px)`;
  scrim.style.opacity = String(1 - to / height);
  if (reducedMotion()) {
    return;
  }
  // A fast release shortens the motion, so the panel keeps its speed.
  const distance = Math.abs(to - from);
  const duration =
    velocity > 0 && distance > 0
      ? Math.min(SETTLE_MS, Math.max(180, (distance / velocity) * 2000))
      : SETTLE_MS;
  scrim.animate(
    [{ opacity: 1 - from / height }, { opacity: 1 - to / height }],
    { duration, easing: SPRING }
  );
  try {
    await panel.animate(
      [
        { transform: `translateY(${from}px)` },
        { transform: `translateY(${to}px)` },
      ],
      { duration, easing: SPRING }
    ).finished;
  } catch {
    // Interrupted by a newer motion, which now owns the panel.
  }
};

export const lockScroll = (locked: boolean) => {
  document.documentElement.style.overflow = locked ? "hidden" : "";
};
