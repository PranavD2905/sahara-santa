import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { env } from "@/lib/env";
import { isDomainError } from "@/server/errors";
import { getGroupView, type GroupView } from "@/server/groups";
import { requireUser } from "@/server/session";

/**
 * Loads a Group for an Organizer-only page (Settings, Invite). Non-members
 * get a 404; Members who aren't the Organizer go back to the Group page.
 */
export async function loadForOrganizer(
  id: string,
  path: string,
): Promise<{ g: GroupView; meId: string; inviteUrl: string } | { redirectTo: string }> {
  const me = await requireUser(path);
  let g: GroupView;
  try {
    g = await getGroupView(db, me.id, id);
  } catch (e) {
    if (isDomainError(e) && e.code === "not-found") notFound();
    throw e;
  }
  if (!g.isOrganizer) return { redirectTo: `/groups/${id}` };
  return { g, meId: me.id, inviteUrl: `${env().BETTER_AUTH_URL}/join/${g.inviteCode}` };
}
