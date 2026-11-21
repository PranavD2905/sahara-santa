"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Notice } from "@/components/ui";
import { authClient, placeholderEmail } from "@/lib/auth-client";

export function SignUpForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setError(null);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) {
      setError("Passwords don't match.");
      return;
    }
    const username = String(form.get("username")).trim().toLowerCase();
    setPending(true);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      username,
      email: placeholderEmail(username),
      password,
    });
    setPending(false);
    if (error) {
      setError(
        error.code === "USERNAME_IS_ALREADY_TAKEN" || error.code === "USER_ALREADY_EXISTS"
          ? "That username is taken. Try another."
          : (error.message ?? "Sign up failed."),
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <Card>
      <form action={onSubmit} className="space-y-4">
        <Field label="Display name" name="name" required maxLength={60} autoComplete="name" hint="What your friends see." />
        <Field
          label="Username"
          name="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9_.]+"
          autoComplete="username"
          autoCapitalize="none"
          hint="3–30 letters, numbers, dots or underscores. You sign in with this."
        />
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
