import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "./button.tsx";
import { ChevronDownIcon, WarningIcon } from "./icons.tsx";
import { ActivityIndicator } from "./progress.tsx";
import { recipes } from "./recipes.ts";
import { color, font, motion, radius, space } from "./tokens.stylex.ts";

/** A word of a heading or paragraph: where it starts and ends in the text. */
export type ReadAlongWord = readonly [from: number, to: number, ...number[]];

/**
 * One item of what is read aloud: text, shown exactly as the voice says it,
 * or one of the article's visuals, shown as on the page. `said` tells
 * whether the voice says anything for a visual.
 */
export type ReadAlongItem =
  | {
      readonly kind: "heading" | "paragraph";
      readonly text: string;
      readonly words: readonly ReadAlongWord[];
    }
  | {
      readonly kind: "picture";
      readonly src: string;
      readonly alt: string;
      readonly said: boolean;
    }
  | {
      readonly kind: "code";
      readonly code: string;
      readonly said: boolean;
    }
  | {
      readonly kind: "table";
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
      readonly said: boolean;
    };

/** Where the voice is: an item, and a word of its text once it has begun. */
export interface ReadAlongPosition {
  readonly item: number;
  readonly word: number | undefined;
}

const styles = stylex.create({
  // Visuals keep their own width and scroll sideways when wider.
  code: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    color: color.label,
    fontFamily:
      'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: font.subheadline,
    lineHeight: 1.6,
    margin: 0,
    overflowX: "auto",
    padding: space.lg,
    whiteSpace: "pre",
  },
  current: { color: color.label },
  figure: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    margin: 0,
  },
  follow: { boxShadow: "0 6px 20px rgb(0 0 0 / 0.16)" },
  // Stays in reach at the bottom while the text scrolls beneath it.
  // Text scrolling beneath fades out, so none shows around the controls.
  footer: {
    alignItems: "center",
    backgroundImage: `linear-gradient(to top, ${color.elevated} 55%, transparent)`,
    // Down over the sheet's bottom padding, to the screen's edge.
    bottom: `calc(-1 * max(${space.xxl}, env(safe-area-inset-bottom)))`,
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    marginBottom: `calc(-1 * max(${space.xxl}, env(safe-area-inset-bottom)))`,
    marginInline: `calc(-1 * ${space.gutter})`,
    paddingBottom: `max(${space.lg}, env(safe-area-inset-bottom))`,
    paddingInline: space.gutter,
    paddingTop: space.xxl,
    pointerEvents: "none",
    position: "sticky",
    zIndex: 1,
  },
  footerButton: { pointerEvents: "auto" },
  footerItem: { pointerEvents: "auto", width: "100%" },
  heading: {
    fontSize: font.title2,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    lineHeight: 1.3,
    margin: 0,
  },
  // The item the voice is on sits on a soft wash, so it is found at a glance.
  item: {
    backgroundColor: "transparent",
    borderRadius: radius.lg,
    borderStyle: "none",
    color: "inherit",
    display: "block",
    font: "inherit",
    marginInline: `calc(-1 * ${space.md})`,
    paddingBlock: space.sm,
    paddingInline: space.md,
    textAlign: "start",
    transitionDuration: motion.regular,
    transitionProperty: "background-color, color",
    width: `calc(100% + 2 * ${space.md})`,
  },
  itemCurrent: { backgroundColor: color.fill },
  list: {
    color: color.label,
    display: "flex",
    flexDirection: "column",
    gap: space.lg,
  },
  note: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    lineHeight: 1.4,
  },
  paragraph: {
    fontSize: font.title3,
    fontWeight: 500,
    lineHeight: 1.55,
    margin: 0,
    whiteSpace: "pre-line",
  },
  // Already said: still readable, a step back.
  past: { color: color.secondaryLabel },
  picture: {
    backgroundColor: color.fill,
    borderRadius: radius.lg,
    display: "block",
    height: "auto",
    maxWidth: "100%",
  },
  reset: { fontSize: "inherit", fontWeight: "inherit", margin: 0 },
  // The word being said.
  spoken: {
    backgroundColor: color.accentFill,
    borderRadius: "0.3em",
    boxDecorationBreak: "clone",
    color: "inherit",
    marginInline: "-0.12em",
    paddingInline: "0.12em",
  },
  table: {
    borderCollapse: "collapse",
    fontSize: font.subheadline,
    lineHeight: 1.45,
    minWidth: "100%",
  },
  tableCell: {
    borderBottomColor: color.separator,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    paddingBlock: space.sm,
    paddingInline: space.md,
    textAlign: "start",
    verticalAlign: "top",
  },
  tableHead: { fontWeight: 600 },
  tableScroll: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    overflowX: "auto",
  },
  visual: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
  },
});

const isText = (
  item: ReadAlongItem
): item is Extract<ReadAlongItem, { kind: "heading" | "paragraph" }> =>
  item.kind === "heading" || item.kind === "paragraph";

/** Whether the voice says the item, so playing from it makes sense. */
const isSaid = (item: ReadAlongItem) => isText(item) || item.said;

/** Text with the word being said marked. */
const Spoken = ({
  text,
  word,
}: {
  readonly text: string;
  readonly word: ReadAlongWord | undefined;
}) => {
  if (!word) {
    return text;
  }
  const [from, to] = word;
  return (
    <>
      {text.slice(0, from)}
      <mark {...stylex.props(styles.spoken)}>{text.slice(from, to)}</mark>
      {text.slice(to)}
    </>
  );
};

const NOTES = {
  code: { said: undefined, silent: "Code, not read aloud" },
  picture: {
    said: "Picture, described aloud",
    silent: "Picture, not described",
  },
  table: { said: undefined, silent: "Table, not read aloud" },
} as const;

/** How a visual shows, as on the page, with a note on what the voice does. */
const VisualView = ({
  item,
}: {
  readonly item: Exclude<ReadAlongItem, { kind: "heading" | "paragraph" }>;
}) => {
  const note = NOTES[item.kind][item.said ? "said" : "silent"];
  const caption = note && <span {...stylex.props(styles.note)}>{note}</span>;
  if (item.kind === "picture") {
    return (
      <figure {...stylex.props(styles.figure)}>
        <img
          src={item.src}
          alt={item.alt}
          loading="lazy"
          decoding="async"
          // The page's site never learns who reads it.
          referrerPolicy="no-referrer"
          {...stylex.props(styles.picture)}
        />
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    );
  }
  if (item.kind === "code") {
    return (
      <div {...stylex.props(styles.visual)}>
        <pre {...stylex.props(styles.code)}>
          <code>{item.code}</code>
        </pre>
        {caption}
      </div>
    );
  }
  return (
    <div {...stylex.props(styles.visual)}>
      <div {...stylex.props(styles.tableScroll)}>
        <table {...stylex.props(styles.table)}>
          {item.head.length > 0 && (
            <thead>
              <tr>
                {item.head.map((cell, index) => (
                  // eslint-disable-next-line react/no-array-index-key -- Cells have no identity but their place.
                  <th
                    key={index}
                    {...stylex.props(styles.tableCell, styles.tableHead)}
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {item.rows.map((row, index) => (
              // eslint-disable-next-line react/no-array-index-key -- Rows have no identity but their place.
              <tr key={index}>
                {row.map((cell, column) => (
                  // eslint-disable-next-line react/no-array-index-key -- Cells have no identity but their place.
                  <td key={column} {...stylex.props(styles.tableCell)}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption}
    </div>
  );
};

/** The item's content, without the control that plays from it. */
const ItemContent = ({
  item,
  word,
}: {
  readonly item: ReadAlongItem;
  readonly word: ReadAlongWord | undefined;
}): ReactNode => {
  if (!isText(item)) {
    return <VisualView item={item} />;
  }
  return item.kind === "heading" ? (
    <span {...stylex.props(styles.heading)}>
      <Spoken text={item.text} word={word} />
    </span>
  ) : (
    <span {...stylex.props(styles.paragraph)}>
      <Spoken text={item.text} word={word} />
    </span>
  );
};

/** The nearest ancestor that scrolls, which follows the voice. */
const scrollerOf = (element: HTMLElement) => {
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") {
      return parent;
    }
  }
  return document.scrollingElement;
};

const prefersReducedMotion = () =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Keeps `target` in the upper middle of its scroller, moving only when it
 * leaves that band, so the text holds still while the voice reads a line.
 */
const keepInView = (target: HTMLElement, force: boolean) => {
  const scroller = scrollerOf(target);
  if (!scroller) {
    return;
  }
  const view = scroller.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  const top = box.top - view.top;
  if (
    !force &&
    top >= view.height * 0.15 &&
    top + box.height <= view.height * 0.7
  ) {
    return;
  }
  scroller.scrollBy({
    behavior: prefersReducedMotion() ? "instant" : "smooth",
    top: top - view.height * 0.3,
  });
};

export interface ReadAlongProps {
  readonly items: readonly ReadAlongItem[];
  /** Where the voice is, or undefined before anything is known. */
  readonly position: ReadAlongPosition | undefined;
  /** Plays from an item the voice says, when the reader taps it. */
  readonly onSeek: (item: number) => void;
  /** The player's controls, kept in reach at the bottom. */
  readonly controls?: ReactNode;
}

/**
 * The narration's text, following the voice: the item it is on sits on a
 * soft wash with the word being said marked, and what it already said steps
 * back. The text scrolls along until the reader scrolls it themselves; then
 * a button brings it back to the voice. Tap any item the voice says to play
 * from there.
 */
export const ReadAlong = ({
  controls,
  items,
  onSeek,
  position,
}: ReadAlongProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const current = position?.item;
  const word = position?.word;

  // The reader takes over by scrolling, by finger, wheel, or keys.
  useEffect(() => {
    const list = listRef.current;
    const scroller = list && scrollerOf(list);
    if (!scroller) {
      return;
    }
    const stop = () => setFollowing(false);
    const keys = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        [
          "ArrowDown",
          "ArrowUp",
          "End",
          "Home",
          "PageDown",
          "PageUp",
          " ",
        ].includes(event.key) &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        stop();
      }
    };
    scroller.addEventListener("touchmove", stop, { passive: true });
    scroller.addEventListener("wheel", stop, { passive: true });
    scroller.addEventListener("keydown", keys);
    return () => {
      scroller.removeEventListener("touchmove", stop);
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("keydown", keys);
    };
  }, []);

  const scrollToVoice = (force: boolean) => {
    const list = listRef.current;
    if (current === undefined || !list) {
      return;
    }
    const item = list.querySelector<HTMLElement>(`[data-item="${current}"]`);
    const target = item?.querySelector<HTMLElement>("mark") ?? item;
    if (target) {
      keepInView(target, force);
    }
  };

  useEffect(() => {
    if (following) {
      scrollToVoice(false);
    }
  });

  return (
    <>
      <div ref={listRef} {...stylex.props(styles.list)}>
        {items.map((item, index) => {
          const isCurrent = index === current;
          const look = stylex.props(
            styles.item,
            current !== undefined && index < current && styles.past,
            isCurrent && styles.current,
            isCurrent && styles.itemCurrent
          );
          const marked =
            isCurrent && isText(item) && word !== undefined
              ? item.words[word]
              : undefined;
          const content = <ItemContent item={item} word={marked} />;
          const key = `${index}-${item.kind}`;
          if (!isSaid(item)) {
            return (
              <div key={key} data-item={index} {...look}>
                {content}
              </div>
            );
          }
          const Wrapper = item.kind === "heading" ? "h3" : "div";
          return (
            <Wrapper
              key={key}
              data-item={index}
              {...stylex.props(styles.reset)}
            >
              <button
                type="button"
                aria-current={isCurrent || undefined}
                onClick={() => {
                  setFollowing(true);
                  onSeek(index);
                }}
                {...stylex.props(
                  recipes.focusRingInset,
                  styles.item,
                  current !== undefined && index < current && styles.past,
                  isCurrent && styles.current,
                  isCurrent && styles.itemCurrent
                )}
              >
                {content}
              </button>
            </Wrapper>
          );
        })}
      </div>
      <div {...stylex.props(styles.footer)}>
        {!following && current !== undefined && (
          <Button
            variant="filled"
            size="small"
            icon={<ChevronDownIcon />}
            style={[styles.follow, styles.footerButton]}
            onClick={() => {
              setFollowing(true);
              scrollToVoice(true);
            }}
          >
            Follow the voice
          </Button>
        )}
        {controls && <div {...stylex.props(styles.footerItem)}>{controls}</div>}
      </div>
    </>
  );
};

const cardStyles = stylex.create({
  body: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    // The text fades out at the bottom, as more follows.
    maskImage: "linear-gradient(to bottom, black 70%, transparent)",
    maxHeight: "13.5rem",
    overflow: "hidden",
    pointerEvents: "none",
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    color: color.label,
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    padding: space.lg,
  },
  header: {
    alignItems: "center",
    display: "flex",
    gap: space.sm,
    justifyContent: "space-between",
  },
  next: { color: color.secondaryLabel },
  status: {
    alignItems: "center",
    color: color.secondaryLabel,
    display: "flex",
    fontSize: font.subheadline,
    gap: space.sm,
    lineHeight: 1.45,
  },
  title: { fontSize: font.body, fontWeight: 600, lineHeight: 1.35, margin: 0 },
});

export interface ReadAlongCardProps {
  /** Whether the text is still loading, failed to load, or is here. */
  readonly status: "loading" | "failed" | "ready";
  readonly items: readonly ReadAlongItem[];
  readonly position: ReadAlongPosition | undefined;
  /** Opens the whole text. */
  readonly onOpen: () => void;
  /** Loads the text again, after it failed. */
  readonly onRetry: () => void;
}

/**
 * A glimpse of the text in the player: what the voice is saying now and
 * what comes next, with a button to read along with the whole text.
 */
export const ReadAlongCard = ({
  items,
  onOpen,
  onRetry,
  position,
  status,
}: ReadAlongCardProps) => {
  const index = position?.item ?? 0;
  const shown = items.slice(index, index + 2);
  return (
    <section aria-label="Read along" {...stylex.props(cardStyles.card)}>
      <div {...stylex.props(cardStyles.header)}>
        <h3 {...stylex.props(cardStyles.title)}>Read along</h3>
        {status === "ready" && (
          <Button variant="tinted" size="small" onClick={onOpen}>
            Show text
          </Button>
        )}
        {status === "failed" && (
          <Button variant="tinted" size="small" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
      {status === "loading" && (
        <p {...stylex.props(cardStyles.status)}>
          <ActivityIndicator size="small" />
          Loading the text…
        </p>
      )}
      {status === "failed" && (
        <p {...stylex.props(cardStyles.status)}>
          <WarningIcon />
          The text could not load. Check your connection, then try again.
        </p>
      )}
      {status === "ready" && (
        // A glimpse only: the whole text, with its controls, is a tap away.
        <div aria-hidden="true" {...stylex.props(cardStyles.body)}>
          {shown.map((item, offset) => (
            <div
              key={`${index + offset}-${item.kind}`}
              {...stylex.props(offset > 0 && cardStyles.next)}
            >
              <ItemContent
                item={item}
                word={
                  offset === 0 && isText(item) && position?.word !== undefined
                    ? item.words[position.word]
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
