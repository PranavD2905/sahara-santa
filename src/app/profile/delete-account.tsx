"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button, Field, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function DeleteAccount() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState(false);
  const password = useRef("");

  async function deleteAccount() {
    setAsking(false);
    setPending(true);
    setError(null);
    const { error } = await authClient.deleteUser({ password: password.current });
    setPending(false);
    if (error) setError(error.message ?? "Couldn't delete the account.");
    else {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <form
      action={(form) => {
        password.current = String(form.get("password"));
        setAsking(true);
      }}
      className="space-y-3"
    >
      <p className="text-sm text-muted">
        You&apos;ll leave every Group. If a Draw has happened, your Santa gets your person instead.
        Groups you organise must be transferred or deleted first.
      </p>
      <Field label="Password" name="password" type="password" required autoComplete="current-password" />
      <Notice tone="error">{error}</Notice>
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Deleting…" : "Delete account"}
      </Button>
      <ConfirmDialog
        open={asking}
        title="Delete your account?"
        body="You'll leave every Group and your profile, picture and song are deleted. This can't be undone."
        confirmLabel="Delete my account"
        tone="danger"
        onCancel={() => setAsking(false)}
        onConfirm={deleteAccount}
      />
    </form>
  );
}
