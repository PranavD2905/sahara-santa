"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function DeleteAccount() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    if (!window.confirm("Delete your account? You'll leave every Group. This can't be undone.")) return;
    setPending(true);
    setError(null);
    const { error } = await authClient.deleteUser({ password: String(form.get("password")) });
    setPending(false);
    if (error) setError(error.message ?? "Couldn't delete the account.");
    else {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <p className="text-sm text-neutral-500">
        You&apos;ll leave every Group. If a Draw has happened, your Santa gets your person instead.
        Groups you organise must be transferred or deleted first.
      </p>
      <Field label="Password" name="password" type="password" required autoComplete="current-password" />
      <Notice tone="error">{error}</Notice>
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Deleting…" : "Delete account"}
      </Button>
    </form>
  );
}
