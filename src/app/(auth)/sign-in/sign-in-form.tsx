"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setError(null);
    setPending(true);
    const { error } = await authClient.signIn.username({
      username: String(form.get("username")).trim().toLowerCase(),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      setError(error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Wrong username or password.");
      return;
    }
    router.replace(next);
    router.refresh();
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
