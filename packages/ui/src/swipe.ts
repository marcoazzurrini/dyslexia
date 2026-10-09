import type { PointerEvent as ReactPointerEvent, MouseEvent } from "react";
import { useEffect, useRef } from "react";

import { project, reducedMotion, rubberband, SPRING } from "./sheet-motion.ts";

/** An action revealed by swiping a row to the left, such as Delete. */
export interface SwipeAction {
  /** The button's text, such as "Delete". */
  readonly label: string;
  readonly onAction: () => void;
}

// Movement before the gesture decides between a swipe and a scroll.
const SLOP = 10;
const SETTLE_MS = 400;
const REST_MS = 100;

// Only one row stays open at a time, as in iOS lists.
let closeOpenRow: (() => void) | null = null;

const currentX = (element: HTMLElement) =>
  new DOMMatrixReadOnly(getComputedStyle(element).transform).m41;

/**
 * Shows the action behind a row only while the row is moved. At rest it
 * stays hidden, so its color never shows at the list's rounded corners.
 */
const reveal = (row: HTMLElement, shown: boolean) => {
  const action = row.previousElementSibling;
  if (action instanceof HTMLElement) {
    action.style.visibility = shown ? "visible" : "hidden";
  }
};

const slide = (element: HTMLElement, to: number, velocity = 0) => {
  const from = currentX(element);
  for (const animation of element.getAnimations()) {
    animation.cancel();
  }
  element.style.transform = to === 0 ? "" : `translateX(${to}px)`;
  if (to !== 0) {
    reveal(element, true);
  }
  if (reducedMotion() || from === to) {
    if (to === 0) {
      reveal(element, false);
    }
    return;
  }
  // A fast release shortens the motion, so the row keeps the finger's speed.
  const distance = Math.abs(to - from);
  const speed = Math.abs(velocity);
  const duration =
    speed > 0
      ? Math.min(SETTLE_MS, Math.max(160, (distance / speed) * 2000))
      : SETTLE_MS;
  const animation = element.animate(
    [
      { transform: `translateX(${from}px)` },
      { transform: `translateX(${to}px)` },
    ],
    { duration, easing: SPRING }
  );
  if (to === 0) {
    animation.addEventListener("finish", () => reveal(element, false));
  }
};

// Past either end the row resists, as at the end of an iOS list.
const resist = (x: number, width: number) => {
  if (x > 0) {
    return rubberband(x, width);
  }
  if (x < -width) {
    return -width + rubberband(x + width, width);
  }
  return x;
};

interface Gesture {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly offset: number;
  axis: "x" | "y" | null;
  samples: [number, number][];
}

/**
 * Lets a row slide left to reveal an action, following iOS: drag past half
 * the action's width, or flick, to open; tap the row or anywhere else to
 * close. Vertical drags still scroll the page.
 */
export const useSwipe = (enabled: boolean, actionWidth: number) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const open = useRef(false);
  // A drag ends with a click on the row's button, which must not count.
  const swallowClick = useRef(false);

  const close = () => {
    const row = rowRef.current;
    open.current = false;
    if (closeOpenRow === close) {
      closeOpenRow = null;
    }
    if (row) {
      slide(row, 0);
    }
  };

  const openRow = (velocity: number) => {
    const row = rowRef.current;
    if (!row) {
      return;
    }
    if (closeOpenRow && closeOpenRow !== close) {
      closeOpenRow();
    }
    open.current = true;
    closeOpenRow = close;
    slide(row, -actionWidth, velocity);
  };

  // Touching anywhere outside an open row closes it.
  useEffect(() => {
    const onDocumentDown = (event: PointerEvent) => {
      if (
        open.current &&
        event.target instanceof Node &&
        !rowRef.current?.parentElement?.contains(event.target)
      ) {
        close();
      }
    };
    document.addEventListener("pointerdown", onDocumentDown);
    return () => {
      document.removeEventListener("pointerdown", onDocumentDown);
      if (closeOpenRow === close) {
        closeOpenRow = null;
      }
    };
  });

  if (!enabled) {
    return { close, handlers: {}, rowRef };
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    swallowClick.current = false;
    if (!row || event.button !== 0) {
      return;
    }
    const offset = currentX(row);
    for (const animation of row.getAnimations()) {
      animation.cancel();
    }
    row.style.transform = offset === 0 ? "" : `translateX(${offset}px)`;
    gesture.current = {
      axis: null,
      offset,
      pointerId: event.pointerId,
      samples: [[event.timeStamp, offset]],
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { current: row } = rowRef;
    const { current } = gesture;
    if (!row || current?.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (current.axis === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) {
        return;
      }
      current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (current.axis === "x") {
        row.setPointerCapture(event.pointerId);
        reveal(row, true);
      }
    }
    if (current.axis !== "x") {
      return;
    }
    const x = resist(current.offset + dx, actionWidth);
    row.style.transform = `translateX(${x}px)`;
    current.samples = [...current.samples.slice(-4), [event.timeStamp, x]];
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { current: row } = rowRef;
    const { current } = gesture;
    gesture.current = null;
    if (!row || current?.pointerId !== event.pointerId) {
      return;
    }
    if (current.axis !== "x") {
      return;
    }
    swallowClick.current = true;
    const [first, last] = [current.samples[0], current.samples.at(-1)];
    const elapsed = first && last ? last[0] - first[0] : 0;
    // A finger that rested before lifting has no speed left to carry.
    const resting = last ? event.timeStamp - last[0] > REST_MS : true;
    const velocity =
      first && last && elapsed > 0 && !resting
        ? ((last[1] - first[1]) / elapsed) * 1000
        : 0;
    // Decide from where the flick would land, not where the finger lifted.
    if (currentX(row) + project(velocity) < -actionWidth / 2) {
      openRow(velocity);
    } else {
      open.current = false;
      slide(row, 0, velocity);
    }
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (swallowClick.current) {
      // The click that ends a drag belongs to the drag.
      swallowClick.current = false;
    } else if (open.current) {
      // A tap on an open row closes it, as in iOS, instead of acting.
      close();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    close,
    handlers: {
      onClickCapture,
      onPointerCancel: onPointerUp,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
    rowRef,
  };
};
