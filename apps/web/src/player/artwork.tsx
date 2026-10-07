import { WaveformIcon } from "@dyslexia/ui";
import { color, radius } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  art: {
    alignItems: "center",
    backgroundColor: color.accent,
    color: color.onAccent,
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
  },
  large: {
    aspectRatio: "1",
    borderRadius: radius.xl,
    boxShadow: "0 16px 40px rgb(0 0 0 / 0.18)",
    fontSize: "4rem",
    marginInline: "auto",
    maxWidth: "15rem",
    width: "62%",
  },
  small: {
    borderRadius: radius.full,
    fontSize: "1.1rem",
    height: "2.75rem",
    width: "2.75rem",
  },
});

/** Stands in for cover art, which narrations do not have. */
export const Artwork = ({ size }: { size: "small" | "large" }) => (
  <span aria-hidden="true" {...stylex.props(styles.art, styles[size])}>
    <WaveformIcon />
  </span>
);
