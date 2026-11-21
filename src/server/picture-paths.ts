import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { groupMember } from "@/db/schema";
import type { AppDb } from "./db-types";

/**
 * Picture storage paths, and who may see them. Kept free of storage and
 * Next.js imports so it can be unit-tested.
 *
 *   profiles/{userId}/{random}.webp            Profile Picture
 *   overrides/{groupId}/{userId}/{random}.webp Organizer Override in one Group
 */

export const PICTURE_URL_PREFIX = "/api/pictures/";

const ID = "[A-Za-z0-9_-]{1,64}";
const PROFILE = new RegExp(`^profiles/(${ID})/${ID}\\.webp$`);
const OVERRIDE = new RegExp(`^overrides/(${ID})/(${ID})/${ID}\\.webp$`);

export type PicturePath =
  | { kind: "profile"; ownerId: string; path: string }
  | { kind: "override"; groupId: string; ownerId: string; path: string };

/** Strict parse: anything else (including `..`) is rejected. */
export function parsePicturePath(path: string): PicturePath | null {
  const p = PROFILE.exec(path);
  if (p) return { kind: "profile", ownerId: p[1], path };
  const o = OVERRIDE.exec(path);
  if (o) return { kind: "override", groupId: o[1], ownerId: o[2], path };
  return null;
}

export const urlForPath = (path: string) => `${PICTURE_URL_PREFIX}${path}`;

export function pathFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith(PICTURE_URL_PREFIX)) return null;
  const path = url.slice(PICTURE_URL_PREFIX.length);
  return parsePicturePath(path) ? path : null;
}

async function isMemberOf(db: AppDb, groupId: string, userId: string) {
  const [m] = await db
    .select({ u: groupMember.userId })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)));
  return Boolean(m);
}

/** Pictures are visible only to people who share a Group with the owner. */
export async function canViewPicture(
  db: AppDb,
  viewerId: string,
  path: string,
): Promise<boolean> {
  const parsed = parsePicturePath(path);
  if (!parsed) return false;
  if (parsed.kind === "override") return isMemberOf(db, parsed.groupId, viewerId);
  if (parsed.ownerId === viewerId) return true;

  const other = alias(groupMember, "other");
  const [shared] = await db
    .select({ g: groupMember.groupId })
    .from(groupMember)
    .innerJoin(other, eq(other.groupId, groupMember.groupId))
    .where(and(eq(groupMember.userId, viewerId), eq(other.userId, parsed.ownerId)))
    .limit(1);
  return Boolean(shared);
}
