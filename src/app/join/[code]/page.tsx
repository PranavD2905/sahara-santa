import { ActionForm } from "@/components/action-form";
import { Button, Card, Notice, Page } from "@/components/ui";
import { db } from "@/db";
import { previewByCode } from "@/server/groups";
import { requireUser } from "@/server/session";
import { joinAction } from "../../groups/actions";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Sign in (or sign up) first, then come back here.
  await requireUser(`/join/${code}`);
  const preview = await previewByCode(db, code);

  if (!preview) {
    return (
      <Page title="Invite link not found">
        <Notice tone="error">This invite link isn&apos;t valid. Ask the Organizer for a new one.</Notice>
      </Page>
    );
  }

  return (
    <Page title={`Join ${preview.name}`}>
      <Card>
        <p className="mb-4">
          {preview.memberCount} {preview.memberCount === 1 ? "Member" : "Members"} so far.
        </p>
        {preview.joinable ? (
          <ActionForm action={joinAction.bind(null, code)}>
            <Button type="submit">Join Group</Button>
          </ActionForm>
        ) : (
          // Existing Members still get through: joinByCode returns them to the Group.
          <ActionForm action={joinAction.bind(null, code)}>
            <Notice>Joining is closed for this Group.</Notice>
            <Button type="submit" variant="secondary">
              I&apos;m already a Member
            </Button>
          </ActionForm>
        )}
      </Card>
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
