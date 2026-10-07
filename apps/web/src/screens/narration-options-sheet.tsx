import type { Narration } from "@dyslexia/narrations/client";
import { Button, Sheet, Text, TrashIcon } from "@dyslexia/ui";

import { formatDuration, siteOf } from "../lib/recording";

export interface NarrationOptionsSheetProps {
  /** The narration to act on, or `null` when closed. */
  readonly narration: Extract<Narration, { state: "ready" }> | null;
  readonly onClose: () => void;
  readonly onDelete: () => void;
}

/** What can be done with a ready narration besides playing it. */
export const NarrationOptionsSheet = ({
  narration,
  onClose,
  onDelete,
}: NarrationOptionsSheetProps) => (
  <Sheet
    open={narration !== null}
    onClose={onClose}
    title={narration?.title ?? "Narration"}
  >
    {narration && (
      <>
        <Text tone="secondary">
          {siteOf(narration.url)} · {formatDuration(narration.durationSeconds)}
        </Text>
        <Button
          variant="destructive"
          size="large"
          block
          icon={<TrashIcon />}
          onClick={onDelete}
        >
          Delete narration
        </Button>
      </>
    )}
  </Sheet>
);
