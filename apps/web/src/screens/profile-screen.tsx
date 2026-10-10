import {
  ActivityIndicator,
  Avatar,
  ListButton,
  ListRow,
  ListSection,
  Notice,
  Screen,
  Text,
} from "@dyslexia/ui";
import { space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  identity: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: space.xs,
    paddingTop: space.sm,
    textAlign: "center",
  },
  loading: { display: "flex", justifyContent: "center", padding: space.xl },
});

export interface Account {
  readonly name: string;
  readonly email: string;
}

export interface ProfileScreenProps {
  /** `null` while it loads. */
  readonly account: Account | null;
  /** Why the account could not be loaded. */
  readonly error?: string;
  readonly busy: boolean;
  readonly onSignOut: () => void;
  readonly bottomInset?: string;
}

/** Who is signed in, and signing out. */
export const ProfileScreen = ({
  account,
  bottomInset,
  busy,
  error,
  onSignOut,
}: ProfileScreenProps) => (
  <Screen title="Profile" bottomInset={bottomInset}>
    {error && (
      <Notice tone="danger" title="Could not load your account">
        {error}
      </Notice>
    )}
    {!account && !error && (
      <div {...stylex.props(styles.loading)}>
        <ActivityIndicator label="Loading your account" />
      </div>
    )}
    {account && (
      <div {...stylex.props(styles.identity)}>
        <Avatar name={account.name || account.email} />
        <Text as="h2" variant="title2">
          {account.name}
        </Text>
        <Text tone="secondary">{account.email}</Text>
      </div>
    )}
    <ListSection
      header="This device"
      footer="Your place in each narration and your speed are saved on this device only."
    >
      <ListRow title="Signed in with" detail="Google" />
      <ListRow title="Stays signed in for" detail="A year of use" />
    </ListSection>
    <ListSection>
      <ListButton
        title="Sign out"
        tone="destructive"
        accessory={busy ? <ActivityIndicator /> : null}
        disabled={busy}
        aria-busy={busy}
        onClick={onSignOut}
      />
    </ListSection>
  </Screen>
);
