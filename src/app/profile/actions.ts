"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { lookupSong, searchSongs, type SongResult } from "@/lib/songs";
import { DomainError, isDomainError } from "@/server/errors";
import { pathFromUrl } from "@/server/picture-paths";
import { deletePicture, readUpload, storePicture } from "@/server/pictures";
import * as profile from "@/server/profile";
import type { ActionState } from "../groups/actions";

async function actor(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/profile");
  return session.user.id;
}

async function attempt(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    revalidatePath("/", "layout");
    return message ? { message } : {};
  } catch (e) {
    if (isDomainError(e)) return { error: e.message };
    throw e;
  }
}

export async function saveProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  return attempt(async () => {
    await profile.updateProfile(db, me, {
      name: String(form.get("name") ?? ""),
      bio: String(form.get("bio") ?? ""),
    });
    return "Saved.";
  });
}

export async function uploadPictureAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  return attempt(async () => {
    const url = await storePicture({ userId: me }, await readUpload(form.get("picture")));
    const previous = await profile.setPicture(db, me, url);
    await deletePicture(pathFromUrl(previous));
    return "Picture updated.";
  });
}

export async function removePictureAction(): Promise<ActionState> {
  const me = await actor();
  return attempt(async () => {
    await deletePicture(pathFromUrl(await profile.setPicture(db, me, null)));
  });
}

export async function searchSongsAction(term: string): Promise<{ results: SongResult[]; error?: string }> {
  await actor();
  try {
    return { results: await searchSongs(term) };
  } catch {
    return { results: [], error: "Music search is unavailable right now." };
  }
}

/** The track details are re-fetched here, never trusted from the client. */
export async function chooseSongAction(trackId: string): Promise<ActionState> {
  const me = await actor();
  return attempt(async () => {
    // A lookup failure (network, unknown id) is reported, not thrown.
    const song = await lookupSong(trackId).catch(() => null);
    if (!song) throw new DomainError("invalid", "Couldn't find that song. Try another.");
    await profile.setSong(db, me, song);
    return "Song saved.";
  });
}

export async function clearSongAction(): Promise<ActionState> {
  const me = await actor();
  return attempt(() => profile.setSong(db, me, null));
}
