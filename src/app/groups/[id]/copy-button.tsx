"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  // When the clipboard is blocked (e.g. non-HTTPS), show the link to copy by hand.
  const [manual, setManual] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setManual(true);
          }
        }}
      >
        {copied ? "✓ Copied" : "Copy link"}
      </Button>
      <ConfirmDialog
        open={manual}
        title="Copy the invite link"
        body={
          <>
            <p className="mb-2">Your browser blocked automatic copying. Select the link and copy it:</p>
            <input
              readOnly
              value={text}
              onFocus={(e) => e.currentTarget.select()}
              className="field-input font-mono text-sm"
              aria-label="Invite link"
            />
          </>
        }
        confirmLabel="Done"
        cancelLabel={null}
        onCancel={() => setManual(false)}
        onConfirm={() => setManual(false)}
      />
    </>
  );
}
