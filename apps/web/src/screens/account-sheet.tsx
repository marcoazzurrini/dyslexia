import { Button, Sheet, Text } from "@dyslexia/ui";

export interface AccountSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly busy: boolean;
  readonly onSignOut: () => void;
}

/** Shows the session and lets the person sign out. */
export const AccountSheet = ({
  busy,
  onClose,
  onSignOut,
  open,
}: AccountSheetProps) => (
  <Sheet open={open} onClose={onClose} title="Account">
    <Text tone="secondary">
      Signed in with Google. This device stays signed in for a year of use.
    </Text>
    <Button
      variant="destructive"
      size="large"
      block
      loading={busy}
      onClick={onSignOut}
    >
      Sign out
    </Button>
  </Sheet>
);
