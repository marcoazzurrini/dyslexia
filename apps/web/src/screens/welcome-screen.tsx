import { ActivityIndicator, Button, Notice, Text } from "@dyslexia/ui";
import { color, radius, size, space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

import type { SessionState } from "../lib/session";

const styles = stylex.create({
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: space.lg,
  },
  checking: { display: "flex", justifyContent: "center", padding: space.xl },
  hero: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    textAlign: "center",
  },
  icon: {
    borderRadius: radius.xl,
    boxShadow: "0 10px 30px rgb(0 0 0 / 0.14)",
    marginBottom: space.md,
  },
  lead: { maxWidth: "24rem", textWrap: "pretty" },
  note: { textAlign: "center" },
  screen: {
    backgroundColor: color.background,
    color: color.label,
    display: "flex",
    flexDirection: "column",
    gap: space.huge,
    justifyContent: "space-between",
    marginInline: "auto",
    maxWidth: size.measure,
    minHeight: "100dvh",
    outlineStyle: "none",
    paddingBottom: `max(${space.xxxl}, env(safe-area-inset-bottom))`,
    paddingInline: space.gutter,
    paddingTop: `calc(env(safe-area-inset-top) + 18vh)`,
  },
});

export interface WelcomeScreenProps {
  readonly session: Exclude<SessionState, { status: "signed-in" }>;
  /** Why the last sign-in did not finish, if it did not. */
  readonly signInError?: "account_not_allowed" | "failed";
  readonly busy: boolean;
  readonly onSignIn: () => void;
  readonly onRetry: () => void;
}

/** The first screen: what the app does, and Google sign-in. */
export const WelcomeScreen = ({
  busy,
  onRetry,
  onSignIn,
  session,
  signInError,
}: WelcomeScreenProps) => (
  <main id="main-content" tabIndex={-1} {...stylex.props(styles.screen)}>
    <div {...stylex.props(styles.hero)}>
      <img
        src="/icon.svg"
        alt=""
        width={96}
        height={96}
        {...stylex.props(styles.icon)}
      />
      <Text as="h1" variant="largeTitle">
        Reader
      </Text>
      <Text variant="body" tone="secondary" style={styles.lead}>
        Paste an article link and listen to it, read aloud in a clear, calm
        voice.
      </Text>
    </div>

    <div {...stylex.props(styles.actions)}>
      {session.status === "checking" && (
        <div {...stylex.props(styles.checking)}>
          <ActivityIndicator size="large" label="Checking sign-in" />
        </div>
      )}
      {session.status === "error" && (
        <Notice
          tone="danger"
          title="Could not reach the app"
          action={
            <Button variant="tinted" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {session.message}
        </Notice>
      )}
      {session.status === "unconfigured" && (
        <Notice
          tone="warning"
          title="Narration setup needed"
          action={
            <Button variant="tinted" onClick={onRetry}>
              Check setup again
            </Button>
          }
        >
          Ask the server owner to configure Google sign-in and the required
          narration providers.
        </Notice>
      )}
      {session.status === "signed-out" && (
        <>
          {session.expired && !signInError && (
            <Notice tone="info" announce title="You were signed out">
              Sign in again to see your narrations.
            </Notice>
          )}
          {signInError && (
            <Notice tone="danger" announce title="Sign-in did not finish">
              {signInError === "account_not_allowed"
                ? "That Google account cannot use this app. Choose your own account."
                : "Try again."}
            </Notice>
          )}
          <Button size="large" block loading={busy} onClick={onSignIn}>
            {busy ? "Opening Google…" : "Sign in with Google"}
          </Button>
          <Text variant="footnote" tone="secondary" style={styles.note}>
            This device stays signed in for a year of use.
          </Text>
        </>
      )}
    </div>
  </main>
);
