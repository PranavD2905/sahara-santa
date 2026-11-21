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
    <Page title="Sign in">
      <SignInForm next={next} />
      <p className="text-sm">
        New here?{" "}
        <Link className="underline" href={`/sign-up?next=${encodeURIComponent(next)}`}>
          Create an account
        </Link>
        {" · "}
        <Link className="underline" href="/forgot-password">
          Forgot password?
        </Link>
      </p>
    </Page>
  );
}
