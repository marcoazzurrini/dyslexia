import type { Narration } from "@dyslexia/narrations/client";
import { Button, CheckIcon, Sheet, Text, TrashIcon } from "@dyslexia/ui";

import { formatDuration, siteOf } from "../lib/recording";

export interface NarrationOptionsSheetProps {
  /** The narration to act on, or `null` when closed. */
  readonly narration: Extract<Narration, { state: "ready" }> | null;
  /** The listener finished the narration, so it can be marked unfinished. */
  readonly finished: boolean;
  readonly onClose: () => void;
  /** Marks the narration finished, or unfinished when it already is. */
  readonly onMarkFinished: (finished: boolean) => void;
  readonly onDelete: () => void;
}

/** What can be done with a ready narration besides playing it. */
export const NarrationOptionsSheet = ({
  finished,
  narration,
  onClose,
  onDelete,
  onMarkFinished,
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
          variant="tinted"
          size="large"
          block
          icon={finished ? undefined : <CheckIcon />}
          onClick={() => onMarkFinished(!finished)}
        >
          {finished ? "Mark as unfinished" : "Mark as finished"}
        </Button>
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
