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
    <Page narrow title="Sign in">
      <SignInForm next={next} />
      <p className="text-sm">
        New here?{" "}
        <Link className="underline" href={`/sign-up?next=${encodeURIComponent(next)}`}>
          Create an account
        </Link>
      </p>
      <p className="text-sm text-neutral-500">
        Forgot your password? Ask your Group&apos;s Organizer to reset it from Group Settings.
      </p>
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
