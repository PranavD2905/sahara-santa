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
    <Page title="Create your account">
      <SignUpForm next={next} />
      <p className="text-sm">
        Already have an account?{" "}
        <Link className="underline" href={`/sign-in?next=${encodeURIComponent(next)}`}>
          Sign in
        </Link>
      </p>
    </Page>
  );
}
