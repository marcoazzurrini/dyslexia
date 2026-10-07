import type { Narration } from "@dyslexia/narrations/client";
import { Button, Notice, Sheet, Text } from "@dyslexia/ui";
import { space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

import { siteOf } from "../lib/recording";

const styles = stylex.create({
  actions: { display: "flex", flexDirection: "column", gap: space.md },
});

export interface FailedSheetProps {
  /** The failed narration to show, or `null` when closed. */
  readonly narration: Extract<Narration, { state: "failed" }> | null;
  readonly onClose: () => void;
  /** Which action is in progress. */
  readonly busy: "retry" | "remove" | null;
  /** Why the last action failed. */
  readonly error?: string;
  readonly onRetry: () => void;
  readonly onRemove: () => void;
}

/** Why a narration failed, with a way to make it again or let it go. */
export const FailedSheet = ({
  busy,
  error,
  narration,
  onClose,
  onRemove,
  onRetry,
}: FailedSheetProps) => (
  <Sheet
    open={narration !== null}
    onClose={onClose}
    title={narration?.title ?? "Narration"}
  >
    {narration && (
      <>
        <Text tone="secondary">{siteOf(narration.url)}</Text>
        <Notice tone="danger" title="This narration could not be made">
          {narration.reason} Nothing was kept from the attempt.
        </Notice>
        {error && (
          <Notice tone="danger" announce title="That did not work">
            {error}
          </Notice>
        )}
        <div {...stylex.props(styles.actions)}>
          <Button
            size="large"
            block
            loading={busy === "retry"}
            disabled={busy !== null}
            onClick={onRetry}
          >
            Try again
          </Button>
          <Button
            variant="gray"
            size="large"
            block
            loading={busy === "remove"}
            disabled={busy !== null}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </>
    )}
  </Sheet>
);
