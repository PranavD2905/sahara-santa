"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setError(null);
    setInfo(null);
    setUnverifiedEmail(null);
    setPending(true);
    const email = String(form.get("email")).trim();
    const { error } = await authClient.signIn.email({
      email,
      password: String(form.get("password")),
    });
    setPending(false);
    if (!error) {
      router.replace(next);
      router.refresh();
      return;
    }
    if (error.code === "EMAIL_NOT_VERIFIED") {
      setUnverifiedEmail(email);
      setError("Verify your email before signing in.");
    } else {
      setError(error.message ?? "Sign in failed.");
    }
  }

  async function resend() {
    if (!unverifiedEmail) return;
    const { error } = await authClient.sendVerificationEmail({
      email: unverifiedEmail,
      callbackURL: next,
    });
    setInfo(error ? (error.message ?? "Couldn't resend.") : `Sent a new link to ${unverifiedEmail}.`);
  }

  return (
    <Card>
      <form action={onSubmit} className="space-y-4">
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field label="Password" name="password" type="password" required autoComplete="current-password" />
        <Notice tone="error">{error}</Notice>
        <Notice>{info}</Notice>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          {unverifiedEmail && (
            <Button type="button" variant="secondary" onClick={resend}>
              Resend verification email
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
