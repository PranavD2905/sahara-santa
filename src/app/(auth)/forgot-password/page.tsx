"use client";

import { useState } from "react";
import { Button, Card, Field, Notice, Page } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(form: FormData) {
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email")).trim(),
      redirectTo: "/reset-password",
    });
    if (error) setError(error.message ?? "Something went wrong.");
    else setDone(true);
  }

  return (
    <Page narrow backHref="/sign-in" title="Reset your password">
      <Card>
        {done ? (
          // Same message whether or not the account exists.
          <Notice tone="success">If that email has an account, a reset link is on its way.</Notice>
        ) : (
          <form action={onSubmit} className="space-y-4">
            <Field label="Email" name="email" type="email" required autoComplete="email" />
            <Notice tone="error">{error}</Notice>
            <Button type="submit">Send reset link</Button>
          </form>
        )}
      </Card>
    </Page>
  );
}
