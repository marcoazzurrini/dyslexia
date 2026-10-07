import { Button, Notice, TextArea, TextField } from "@dyslexia/ui";
import { space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import type { SourceSubmission } from "../lib/pipeline-client";
import type { JobDetail } from "../pipeline/contracts";

const styles = stylex.create({
  form: { display: "flex", flexDirection: "column", gap: space.xl },
});

/** Lets the person trim the extracted article before it is adapted. */
export const SourceReview = ({
  busy,
  detail,
  onSubmit,
}: {
  busy: boolean;
  detail: JobDetail;
  onSubmit: (submission: SourceSubmission) => void;
}) => {
  const [title, setTitle] = useState(detail.source?.title ?? detail.job.title);
  const [markdown, setMarkdown] = useState(detail.source?.markdown ?? "");
  return (
    <form
      {...stylex.props(styles.form)}
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() && markdown.trim()) {
          onSubmit({ markdown, title: title.trim() });
        }
      }}
    >
      <Notice title="Review the extracted article">
        Delete anything that is not part of the article, such as menus or
        comments. Only the text left below is adapted.
      </Notice>
      <fieldset disabled={busy} {...stylex.props(styles.form)}>
        <TextField
          label="Article title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextArea
          label="Article text"
          required
          rows={14}
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
        />
        <Button type="submit" size="large" block loading={busy}>
          {busy ? "Submitting…" : "Adapt this text"}
        </Button>
      </fieldset>
    </form>
  );
};
