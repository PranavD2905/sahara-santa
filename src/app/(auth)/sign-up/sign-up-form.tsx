"use client";

import { useState } from "react";
import { Button, Card, Field, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function SignUpForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setError(null);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    const email = String(form.get("email")).trim();
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      email,
      password,
      callbackURL: next,
    });
    setPending(false);
    if (error) setError(error.message ?? "Sign up failed.");
    else setSentTo(email);
  }

  if (sentTo) {
    return (
      <Card>
        <Notice tone="success">
          Check {sentTo} for a verification link. You&apos;ll be signed in once you click it.
        </Notice>
      </Card>
    );
  }

  return (
    <Card>
      <form action={onSubmit} className="space-y-4">
        <Field label="Display name" name="name" required maxLength={60} autoComplete="name" />
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field label="Password" name="password" type="password" required minLength={8} autoComplete="new-password" hint="At least 8 characters." />
        <Field label="Confirm password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        <Notice tone="error">{error}</Notice>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
