import { eq } from "drizzle-orm";
import { user } from "@/db/schema";
import type { AppDb } from "./db-types";
import { DomainError } from "./errors";

export const BIO_MAX = 150;
export const NAME_MAX = 60;

export interface ProfileView {
  name: string;
  email: string;
  image: string | null;
  bio: string | null;
  song: {
    trackId: string;
    title: string | null;
    artist: string | null;
    artworkUrl: string | null;
    explicit: boolean;
  } | null;
}

export async function getProfile(db: AppDb, userId: string): Promise<ProfileView> {
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  if (!u) throw new DomainError("not-found", "Account not found.");
  return {
    name: u.name,
    email: u.email,
    image: u.image,
    bio: u.bio,
    song: u.songTrackId
      ? {
          trackId: u.songTrackId,
          title: u.songTitle,
          artist: u.songArtist,
          artworkUrl: u.songArtworkUrl,
          explicit: u.songExplicit ?? false,
        }
      : null,
  };
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
  if ([...bio].length > BIO_MAX) {
    throw new DomainError("invalid", `Bio must be at most ${BIO_MAX} characters.`);
  }
  await db
    .update(user)
    .set({ name, bio: bio === "" ? null : bio, updatedAt: new Date() })
    .where(eq(user.id, userId));
}

export interface SongChoice {
  trackId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  explicit: boolean;
}

/** `song` must come from a server-side catalog lookup, never the client. */
export async function setSong(db: AppDb, userId: string, song: SongChoice | null): Promise<void> {
  await db
    .update(user)
    .set({
      songTrackId: song?.trackId ?? null,
      songTitle: song?.title ?? null,
      songArtist: song?.artist ?? null,
      songArtworkUrl: song?.artworkUrl ?? null,
      songExplicit: song?.explicit ?? null,
      updatedAt: new Date(),
    })
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
