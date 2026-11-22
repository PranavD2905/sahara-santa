"use client";

import { useRef, useState } from "react";
import { Button, Card, Field, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { navigateAfterAuthentication } from "@/lib/auth-navigation";

export function SignInForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(form: FormData) {
    if (submitting.current) return;
    setError(null);
    submitting.current = true;
    setPending(true);
    try {
      const { error } = await authClient.signIn.username({
        username: String(form.get("username")).trim().toLowerCase(),
        password: String(form.get("password")),
      });
      if (error) {
        setError(error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Wrong username or password.");
      } else {
        navigateAfterAuthentication(next);
        return;
      }
    } catch {
      setError("Could not sign in. Check your connection and try again.");
    }
    submitting.current = false;
    setPending(false);
  }

  return (
    <Card>
      <form action={onSubmit} className="space-y-4">
        <Field label="Username" name="username" required autoComplete="username" autoCapitalize="none" />
        <Field label="Password" name="password" type="password" required autoComplete="current-password" />
        <Notice tone="error">{error}</Notice>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
