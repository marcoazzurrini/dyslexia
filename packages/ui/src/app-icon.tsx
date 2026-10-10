import * as stylex from "@stylexjs/stylex";

import { radius, space } from "./tokens.stylex.ts";

const styles = stylex.create({
  icon: {
    borderRadius: radius.xl,
    boxShadow: "0 10px 30px rgb(0 0 0 / 0.14)",
    marginBottom: space.md,
  },
});

/** The app's icon, large, as a welcome screen leads with it. */
export const AppIcon = ({ src }: { readonly src: string }) => (
  <img src={src} alt="" width={96} height={96} {...stylex.props(styles.icon)} />
);
