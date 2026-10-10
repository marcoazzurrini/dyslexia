import * as stylex from "@stylexjs/stylex";

import { color, font, radius } from "./tokens.stylex.ts";

const styles = stylex.create({
  avatar: {
    alignItems: "center",
    backgroundColor: color.accent,
    borderRadius: radius.full,
    color: color.onAccent,
    display: "flex",
    flexShrink: 0,
    fontSize: font.title1,
    fontWeight: 600,
    height: "4.5rem",
    justifyContent: "center",
    width: "4.5rem",
  },
});

/** A person's initial in a circle, standing in for their photo. */
export const Avatar = ({ name }: { readonly name: string }) => (
  <span aria-hidden="true" {...stylex.props(styles.avatar)}>
    {name.charAt(0).toUpperCase()}
  </span>
);
