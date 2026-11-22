import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { group } from "@/db/schema";
import type { AppDb } from "./db-types";
import { getGroupView, listMyGroups, previewByCode } from "./groups";
import { getProfile } from "./profile";

/** Hash only data this member can already see. Never fetch assignments. */
export async function liveRevision(db: AppDb, userId: string, pathname: string): Promise<string> {
  const profile = await getProfile(db, userId);
  const groupId = /^\/groups\/([^/]+)/.exec(pathname)?.[1];
  const code = /^\/join\/([^/]+)/.exec(pathname)?.[1];
  let page: unknown = null;
  if (groupId && groupId !== "new") {
    const view = await getGroupView(db, userId, groupId);
    // A re-draw can change assignments while the visible status stays "drawn".
    const [revision] = await db.select({ updatedAt: group.updatedAt }).from(group).where(eq(group.id, groupId));
    page = { view, revision };
  } else if (pathname === "/") {
    page = await listMyGroups(db, userId);
  } else if (code) {
    page = await previewByCode(db, code);
  }
  return createHash("sha256").update(JSON.stringify({ profile, page })).digest("hex");
}
