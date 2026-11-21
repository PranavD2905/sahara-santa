import Link from "next/link";
import { redirect } from "next/navigation";
import { Page } from "@/components/ui";
import { InviteCard } from "../organizer-panel";
import { loadForOrganizer } from "../organizer-page";

/** Step 2 of creating a Group: invite people, then go to the Group. */
export default async function InviteStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadForOrganizer(id, `/groups/${id}/invite`);
  if ("redirectTo" in loaded) redirect(loaded.redirectTo);
  const { g, inviteUrl } = loaded;

  return (
    <Page narrow backHref={`/groups/${id}`} title={`Invite people to ${g.name}`}>
      <p className="text-sm text-neutral-500">
        Your Group is ready. Share the link or code, or send email invites. You can come back to this any time from the
        Group page.
      </p>
      <InviteCard group={g} inviteUrl={inviteUrl} />
      <Link
        href={`/groups/${id}`}
        className="inline-block rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white"
      >
        Continue to Group →
      </Link>
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
