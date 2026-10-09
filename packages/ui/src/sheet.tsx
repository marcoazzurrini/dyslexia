import * as stylex from "@stylexjs/stylex";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useId, useRef } from "react";

import { IconButton } from "./icon-button.tsx";
import { CloseIcon } from "./icons.tsx";
import {
  currentY,
  lockScroll,
  project,
  rubberband,
  settle,
} from "./sheet-motion.ts";
import { color, font, radius, size, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  close: { insetInlineEnd: space.lg, position: "absolute" },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: space.xl,
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingBottom: `max(${space.xxl}, env(safe-area-inset-bottom))`,
    paddingInline: space.gutter,
    paddingTop: space.sm,
  },
  dialog: {
    "::backdrop": { backgroundColor: "transparent" },
    backgroundColor: "transparent",
    borderStyle: "none",
    color: color.label,
    fontFamily: font.family,
    height: "100%",
    inset: 0,
    margin: 0,
    maxHeight: "none",
    maxWidth: "none",
    // Clip, not hide: a hidden overflow can still scroll, and showing the
    // dialog focuses its close button while the panel is below the screen,
    // which scrolled the panel up past its place until the slide ended.
    overflow: "clip",
    padding: 0,
    position: "fixed",
    width: "100%",
  },
  grabber: {
    backgroundColor: color.tertiaryLabel,
    borderRadius: radius.full,
    height: "5px",
    marginInline: "auto",
    width: "36px",
  },
  handleArea: {
    cursor: "grab",
    flexShrink: 0,
    paddingTop: space.sm,
    touchAction: "none",
    userSelect: "none",
  },
  header: {
    alignItems: "center",
    display: "flex",
    minHeight: size.navBar,
    paddingInline: space.lg,
    position: "relative",
  },
  hidden: { opacity: 0 },
  panel: {
    backgroundColor: color.elevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    bottom: 0,
    boxShadow: "0 -8px 40px rgb(0 0 0 / 0.18)",
    display: "flex",
    flexDirection: "column",
    insetInline: 0,
    marginInline: "auto",
    maxHeight: "calc(100% - env(safe-area-inset-top) - 0.75rem)",
    maxWidth: "40rem",
    position: "absolute",
    willChange: "transform",
  },
  scrim: {
    backgroundColor: color.scrim,
    inset: 0,
    position: "absolute",
  },
  title: {
    flexGrow: 1,
    fontSize: font.body,
    fontWeight: 600,
    lineHeight: 1.3,
    paddingInline: size.touch,
    textAlign: "center",
  },
});

export interface SheetProps {
  readonly open: boolean;
  /** Called when the person dismisses the sheet. Set `open` to false. */
  readonly onClose: () => void;
  readonly title: string;
  /** Hide the title visually, for content that names itself. */
  readonly hideTitle?: boolean;
  readonly children: ReactNode;
}

/**
 * A modal sheet that slides up from the bottom. Dismiss it by dragging it
 * down, tapping outside, pressing Escape, or the close button.
 */
export const Sheet = ({
  children,
  hideTitle = false,
  onClose,
  open,
  title,
}: SheetProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; samples: [number, number][] } | null>(
    null
  );
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!dialog || !panel || !scrim) {
      return;
    }
    const show = async () => {
      if (open && !dialog.open) {
        dialog.showModal();
        lockScroll(true);
        panel.style.transform = `translateY(${panel.offsetHeight}px)`;
        await settle(panel, scrim, 0);
      } else if (!open && dialog.open) {
        await settle(panel, scrim, panel.offsetHeight);
        dialog.close();
        lockScroll(false);
      }
    };
    void show();
  }, [open]);

  useEffect(() => () => lockScroll(false), []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const onButton =
      event.target instanceof Element && event.target.closest("button");
    if (event.button !== 0 || onButton) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const panel = panelRef.current;
    if (panel) {
      // Grab the panel where it is, even mid-animation.
      const y = currentY(panel);
      for (const animation of panel.getAnimations()) {
        animation.cancel();
      }
      panel.style.transform = `translateY(${y}px)`;
      drag.current = {
        samples: [[event.timeStamp, y]],
        start: event.clientY - y,
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!drag.current || !panel || !scrim) {
      return;
    }
    const raw = event.clientY - drag.current.start;
    const y = raw < 0 ? rubberband(raw, panel.offsetHeight) : raw;
    panel.style.transform = `translateY(${y}px)`;
    scrim.style.opacity = String(1 - Math.max(0, y) / panel.offsetHeight);
    drag.current.samples = [
      ...drag.current.samples.slice(-4),
      [event.timeStamp, y],
    ];
  };

  const onPointerUp = () => {
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    const gesture = drag.current;
    drag.current = null;
    if (!panel || !scrim || !gesture) {
      return;
    }
    const [first, last] = [gesture.samples[0], gesture.samples.at(-1)];
    const elapsed = first && last ? last[0] - first[0] : 0;
    const velocity =
      first && last && elapsed > 0
        ? ((last[1] - first[1]) / elapsed) * 1000
        : 0;
    const y = currentY(panel);
    // Decide from where the flick would land, not where the finger lifted.
    if (y + project(velocity) > panel.offsetHeight / 2) {
      onClose();
    } else {
      void settle(panel, scrim, 0, Math.abs(velocity));
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      {...stylex.props(styles.dialog)}
    >
      <div
        ref={scrimRef}
        aria-hidden="true"
        onClick={() => onClose()}
        {...stylex.props(styles.scrim)}
      />
      <div ref={panelRef} {...stylex.props(styles.panel)}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          {...stylex.props(styles.handleArea)}
        >
          <div aria-hidden="true" {...stylex.props(styles.grabber)} />
          <div {...stylex.props(styles.header)}>
            <h2
              id={titleId}
              {...stylex.props(styles.title, hideTitle && styles.hidden)}
            >
              {title}
            </h2>
            <IconButton
              label="Close"
              icon={<CloseIcon />}
              variant="gray"
              onClick={() => onClose()}
              style={styles.close}
            />
          </div>
        </div>
        <div {...stylex.props(styles.content)}>{children}</div>
      </div>
    </dialog>
  );
};
