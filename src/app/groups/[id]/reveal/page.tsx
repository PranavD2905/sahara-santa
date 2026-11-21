import { Jost, Oswald } from "next/font/google";
import { notFound } from "next/navigation";
import { Notice, Page } from "@/components/ui";
import { db } from "@/db";
import { isDomainError } from "@/server/errors";
import { getGroupView, myRevealState, revealMyAssignment } from "@/server/groups";
import { requireUser } from "@/server/session";
import { TarotReveal } from "./tarot/tarot-reveal";

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500"], variable: "--tr-font-title" });
const jost = Jost({ subsets: ["latin"], weight: ["400", "500"], variable: "--tr-font-body" });

export default async function RevealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser(`/groups/${id}/reveal`);

  let groupName: string;
  try {
    // Membership check: non-members get a 404.
    groupName = (await getGroupView(db, me.id, id)).name;
  } catch (e) {
    if (isDomainError(e) && e.code === "not-found") notFound();
    throw e;
  }

  const state = await myRevealState(db, me.id, id);

  if (!state.hasAssignment) {
    return (
      <Page narrow backHref={`/groups/${id}`} title="No person yet">
        <Notice>There&apos;s no Assignment for you in this Group right now.</Notice>
      </Page>
    );
  }

  // Already revealed: the tarot replays straight onto the same person.
  // Otherwise the first click performs the Reveal (see TarotReveal).
  const initialView = state.revealed ? await revealMyAssignment(db, me.id, id) : null;

  return (
    <TarotReveal
      groupId={id}
      groupName={groupName}
      initialView={initialView}
      fontClassName={`${oswald.variable} ${jost.variable}`}
    />
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
