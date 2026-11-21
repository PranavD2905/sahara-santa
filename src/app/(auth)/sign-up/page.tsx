import Link from "next/link";
import { Page } from "@/components/ui";
import { safeNext } from "@/server/session";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  return (
    <Page narrow title="Create your account" subtitle="Just a username and password. No email needed.">
      <SignUpForm next={next} />
      <p className="text-sm text-cream/80">
        Already have an account?{" "}
        <Link className="text-sand-lt underline underline-offset-4 hover:text-cream" href={`/sign-in?next=${encodeURIComponent(next)}`}>
          Sign in
        </Link>
      </p>
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
