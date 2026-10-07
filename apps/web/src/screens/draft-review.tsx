import { Button, Notice, Switch, TextArea, TextField } from "@dyslexia/ui";
import { color, font, radius, space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import type { ApprovalSubmission } from "../lib/pipeline-client";
import type { JobDetail } from "../pipeline/contracts";

const styles = stylex.create({
  cost: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    display: "grid",
    gap: space.xs,
    gridTemplateColumns: "1fr auto",
    padding: space.lg,
  },
  costLabel: { fontSize: font.body, fontWeight: 500 },
  costNote: {
    color: color.secondaryLabel,
    fontSize: font.footnote,
    gridColumn: "1 / -1",
    lineHeight: 1.4,
  },
  costValue: {
    fontSize: font.title3,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
  },
  form: { display: "flex", flexDirection: "column", gap: space.xl },
});

const MAX_BUDGET_USD = 50;

/**
 * Lets the person edit the narration and approve its speech cost. Any edit
 * withdraws the approval, so audio is never made from unseen text.
 */
export const DraftReview = ({
  busy,
  detail,
  onSubmit,
}: {
  busy: boolean;
  detail: JobDetail;
  onSubmit: (submission: ApprovalSubmission) => void;
}) => {
  const [title, setTitle] = useState(detail.draft?.title ?? detail.job.title);
  const [text, setText] = useState(detail.draft?.text ?? "");
  const [maximum, setMaximum] = useState(
    String(Math.max(10, Math.ceil(detail.job.estimatedTtsUsd * 100) / 100))
  );
  const [approved, setApproved] = useState(false);
  const originalLength =
    detail.job.characters || detail.draft?.text.length || 1;
  const estimate = (detail.job.estimatedTtsUsd * text.length) / originalLength;
  const maxCostUsd = Number(maximum);
  const budgetValid =
    Number.isFinite(maxCostUsd) &&
    maxCostUsd > 0 &&
    maxCostUsd <= MAX_BUDGET_USD &&
    maxCostUsd >= estimate;
  const ready = approved && budgetValid && title.trim() && text.trim();
  return (
    <form
      {...stylex.props(styles.form)}
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) {
          onSubmit({ maxCostUsd, text, title: title.trim() });
        }
      }}
    >
      <Notice title="Review the narration">
        Edit freely; nothing is spent until you approve below.
      </Notice>
      <fieldset disabled={busy} {...stylex.props(styles.form)}>
        <TextField
          label="Narration title"
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setApproved(false);
          }}
        />
        <TextArea
          label="Narration text"
          required
          rows={14}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setApproved(false);
          }}
        />
        <div {...stylex.props(styles.cost)}>
          <span {...stylex.props(styles.costLabel)}>Estimated speech cost</span>
          <span {...stylex.props(styles.costValue)}>
            ${estimate.toFixed(2)}
          </span>
          <span {...stylex.props(styles.costNote)}>
            Speech only, scaled to your edits. Extraction and adaptation are
            billed separately, and the final cost may differ. Set hard limits in
            each provider account.
          </span>
        </div>
        <TextField
          label="Maximum speech cost (USD)"
          type="number"
          min="0.01"
          max={MAX_BUDGET_USD}
          step="0.01"
          required
          inputMode="decimal"
          value={maximum}
          error={
            budgetValid
              ? undefined
              : "Enter a positive maximum that covers the estimated speech cost."
          }
          onChange={(event) => {
            setMaximum(event.target.value);
            setApproved(false);
          }}
        />
        <Switch
          label="Approve speech generation"
          description="Up to the maximum above, for the text as it is now."
          checked={approved}
          required
          onChange={setApproved}
        />
        <Button
          type="submit"
          size="large"
          block
          loading={busy}
          disabled={!ready}
        >
          {busy ? "Submitting…" : "Generate audio"}
        </Button>
      </fieldset>
    </form>
  );
};
