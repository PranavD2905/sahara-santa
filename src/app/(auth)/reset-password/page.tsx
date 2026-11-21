import { Notice, Page } from "@/components/ui";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return (
    <Page narrow title="Choose a new password">
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Notice tone="error">This reset link is invalid or has expired. Request a new one.</Notice>
      )}
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
