import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  hidden: {
    clipPath: "inset(50%)",
    height: "1px",
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: "1px",
  },
});

/** Text for screen readers only, such as "(opens in a new tab)". */
export const VisuallyHidden = ({ children }: { children: ReactNode }) => (
  <span {...stylex.props(styles.hidden)}>{children}</span>
);
