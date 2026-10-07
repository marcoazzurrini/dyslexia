import { Button, LinkIcon, Notice, Sheet, TextField } from "@dyslexia/ui";
import { space } from "@dyslexia/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

const styles = stylex.create({
  form: { display: "flex", flexDirection: "column", gap: space.xl },
});

const INVALID =
  "Enter a valid HTTPS article link without a username or password.";

/** Returns the link to submit, or an error to show. */
export const parseArticleUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) {
      return { error: INVALID };
    }
    return { url: url.href };
  } catch {
    return { error: INVALID };
  }
};

export interface NewNarrationSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly busy: boolean;
  /** Why the server refused the last submission. */
  readonly error?: string;
  readonly onSubmit: (url: string) => void;
}

/** Starts a narration from an article link. */
export const NewNarrationSheet = ({
  busy,
  error,
  onClose,
  onSubmit,
  open,
}: NewNarrationSheetProps) => {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="Add article">
      <form
        noValidate
        {...stylex.props(styles.form)}
        onSubmit={(event) => {
          event.preventDefault();
          const result = parseArticleUrl(value);
          if (result.url) {
            setInvalid("");
            onSubmit(result.url);
          } else {
            setInvalid(result.error ?? INVALID);
          }
        }}
      >
        <TextField
          label="Article link"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="https://example.com/article"
          value={value}
          disabled={busy}
          error={invalid || undefined}
          description="Extracting and adapting the text may cost a little. Audio is only made after you approve the draft."
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid("");
          }}
        />
        {error && (
          <Notice tone="danger" announce title="Could not start the narration">
            {error} Nothing will be resubmitted automatically.
          </Notice>
        )}
        <Button
          type="submit"
          size="large"
          block
          loading={busy}
          icon={<LinkIcon />}
        >
          {busy ? "Starting…" : "Create draft"}
        </Button>
      </form>
    </Sheet>
  );
};
