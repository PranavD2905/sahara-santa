import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice, Page } from "@/components/ui";
import { db } from "@/db";
import { isDomainError } from "@/server/errors";
import { getGroupView, myRevealState, revealMyAssignment } from "@/server/groups";
import { requireUser } from "@/server/session";
import { RevealButton, ReceiverCard } from "./reveal-card";

export default async function RevealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser(`/groups/${id}/reveal`);

  let groupName: string;
  try {
    groupName = (await getGroupView(db, me.id, id)).name;
  } catch (e) {
    if (isDomainError(e) && e.code === "not-found") notFound();
    throw e;
  }

  const state = await myRevealState(db, me.id, id);
  const back = (
    <Link href={`/groups/${id}`} className="text-sm underline">
      Back to {groupName}
    </Link>
  );

  if (!state.hasAssignment) {
    return (
      <Page title="No person yet">
        <Notice>There&apos;s no Assignment for you in this Group right now.</Notice>
        {back}
      </Page>
    );
  }

  // Already revealed: show the card directly. Otherwise wait for the tap.
  const view = state.revealed ? await revealMyAssignment(db, me.id, id) : null;

  return (
    <Page title="Your person">
      {view ? <ReceiverCard view={view} /> : <RevealButton groupId={id} />}
      {back}
    </Page>
  );
}
