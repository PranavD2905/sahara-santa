import { and, eq, isNotNull } from "drizzle-orm";
import { groupMember, user } from "@/db/schema";
import type { AppDb } from "./db-types";
import { DomainError } from "./errors";

export const BIO_MAX = 150;
export const NAME_MAX = 60;

export interface ProfileView {
  name: string;
  username: string | null;
  image: string | null;
  bio: string | null;
}

export async function getProfile(db: AppDb, userId: string): Promise<ProfileView> {
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  if (!u) throw new DomainError("not-found", "Account not found.");
  return {
    name: u.name,
    username: u.displayUsername ?? u.username,
    image: u.image,
    bio: u.bio,
  };
}

/** A group photo can satisfy the requirement for that existing membership. */
export async function organizerPicture(db: AppDb, userId: string, destination = "/"): Promise<string | null> {
  const groupId = /^\/groups\/([^/]+)/.exec(destination)?.[1];
  if (groupId === "new" || destination.startsWith("/join")) return null;
  const conditions = [eq(groupMember.userId, userId), isNotNull(groupMember.pictureOverrideUrl)];
  if (groupId) conditions.push(eq(groupMember.groupId, groupId));
  const rows = await db.select({ image: groupMember.pictureOverrideUrl }).from(groupMember).where(and(...conditions));
  return rows.find((row) => row.image?.trim())?.image ?? null;
}

export async function requireProfilePicture(db: AppDb, userId: string, destination = "/"): Promise<void> {
  if (!(await getProfile(db, userId)).image?.trim() && !(await organizerPicture(db, userId, destination))) {
    throw new DomainError("invalid", "Add a profile picture to complete your profile.");
  }
}

export async function updateProfile(
  db: AppDb,
  userId: string,
  input: { name: string; bio: string },
): Promise<void> {
  const name = input.name.trim();
  // Plain text only: collapse whitespace runs, keep it to one paragraph.
  const bio = input.bio.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > NAME_MAX) {
    throw new DomainError("invalid", `Display name must be 1–${NAME_MAX} characters.`);
  }
  if (!bio) {
    throw new DomainError("invalid", "Add a bio to complete your profile.");
  }
  if ([...bio].length > BIO_MAX) {
    throw new DomainError("invalid", `Bio must be at most ${BIO_MAX} characters.`);
  }
  await db
    .update(user)
    .set({ name, bio, updatedAt: new Date() })
    .where(eq(user.id, userId));
}

/** Sets the Profile Picture URL; returns the previous one for cleanup. */
export async function setPicture(
  db: AppDb,
  userId: string,
  url: string | null,
): Promise<string | null> {
  const [u] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId));
  await db.update(user).set({ image: url, updatedAt: new Date() }).where(eq(user.id, userId));
  return u?.image ?? null;
}
