// Physical motion for the sheet, following Apple's fluid interface
// guidance: motion starts from where the panel is, keeps the finger's speed,
// and can be interrupted at any moment.

// Apple's response for moving things, in seconds.
const RESPONSE = 0.35;
// Fine enough that the spring's speed changes smoothly, not in steps.
const STEP_MS = 10;
// Close enough to rest, as a share of the distance.
const REST = 0.001;

/** A finger that rested this long before lifting has no speed to carry. */
export const REST_MS = 100;

/**
 * A critically damped spring for the Web Animations API, and how long it
 * takes to settle. `velocity` is the speed toward the target when it
 * starts, in distances per second, so motion continues a finger's flick.
 */
export const spring = (velocity = 0) => {
  const omega = (2 * Math.PI) / RESPONSE;
  // Any faster and the spring would overshoot, but nothing here has
  // anywhere to go past its resting place.
  const start = Math.min(Math.max(velocity, -omega), omega);
  const points = [0];
  for (let time = STEP_MS / 1000; ; time += STEP_MS / 1000) {
    const offset = (1 + (omega - start) * time) * Math.exp(-omega * time);
    if (offset < REST) {
      break;
    }
    points.push(Math.round((1 - offset) * 10_000) / 10_000);
  }
  points.push(1);
  return {
    duration: (points.length - 1) * STEP_MS,
    easing: `linear(${points.join(", ")})`,
  };
};

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
 * interrupted and redirected at any moment. `velocity` is the finger's
 * speed along y at release, in pixels per second.
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
  if (reducedMotion() || from === to) {
    return;
  }
  // The panel leaves at the finger's speed, so release has no seam.
  const timing = spring(velocity / (to - from));
  scrim.animate(
    [{ opacity: 1 - from / height }, { opacity: 1 - to / height }],
    timing
  );
  try {
    await panel.animate(
      [
        { transform: `translateY(${from}px)` },
        { transform: `translateY(${to}px)` },
      ],
      timing
    ).finished;
  } catch {
    // Interrupted by a newer motion, which now owns the panel.
  }
};

export const lockScroll = (locked: boolean) => {
  document.documentElement.style.overflow = locked ? "hidden" : "";
};
