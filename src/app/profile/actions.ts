"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { isDomainError } from "@/server/errors";
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

