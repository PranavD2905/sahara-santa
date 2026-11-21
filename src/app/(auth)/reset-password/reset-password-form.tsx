"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Field, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(form: FormData) {
    setError(null);
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) {
      setError("Passwords don't match.");
      return;
    }
    const { error } = await authClient.resetPassword({ newPassword, token });
    if (error) setError(error.message ?? "Couldn't reset the password.");
    else setDone(true);
  }

  if (done) {
    return (
      <Card>
        <Notice tone="success">
          Password changed. <Link className="underline" href="/sign-in">Sign in</Link>
        </Notice>
      </Card>
    );
  }

  return (
    <Card>
      <form action={onSubmit} className="space-y-4">
        <Field label="New password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <Field label="Confirm password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        <Notice tone="error">{error}</Notice>
        <Button type="submit">Change password</Button>
      </form>
    </Card>
  );
}
