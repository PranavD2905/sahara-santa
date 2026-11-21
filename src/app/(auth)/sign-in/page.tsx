import Link from "next/link";
import { Page } from "@/components/ui";
import { safeNext } from "@/server/session";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  return (
    <Page narrow title="Sign in" subtitle="Welcome back. Your person might be waiting.">
      <SignInForm next={next} />
      <p className="text-sm text-cream/80">
        New here?{" "}
        <Link className="text-sand-lt underline underline-offset-4 hover:text-cream" href={`/sign-up?next=${encodeURIComponent(next)}`}>
          Create an account
        </Link>
      </p>
      <p className="text-sm text-cream/70">
        Forgot your password? Ask your Group&apos;s Organizer to reset it from Group Settings.
      </p>
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
