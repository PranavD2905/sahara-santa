import { ActionForm } from "@/components/action-form";
import { Button, Card, Notice, Page, Sparkle } from "@/components/ui";
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
      <Page narrow title="Invite link not found" subtitle="It may have been reset by the Organizer.">
        <Notice tone="error">This invite link isn&apos;t valid. Ask the Organizer for a new link or code.</Notice>
      </Page>
    );
  }

  return (
    <Page narrow title="You're invited" subtitle="Join the Secret Santa, then wait for the Draw.">
      <Card className="text-center">
        <Sparkle className="mx-auto h-7 w-5 text-ink-soft" twinkle />
        <h2 className="mt-3 font-title text-2xl font-medium tracking-[0.12em] break-words uppercase">{preview.name}</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          {preview.memberCount} {preview.memberCount === 1 ? "person has" : "people have"} joined so far.
        </p>
        {preview.joinable ? (
          <ActionForm action={joinAction.bind(null, code)}>
            <Button type="submit" size="lg">Join Group</Button>
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
