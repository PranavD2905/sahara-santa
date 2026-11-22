import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getSession, type Session } from "@/lib/auth";
import { getProfile, organizerPicture } from "./profile";

/** Require a complete profile, except on the page where users finish it. */
export async function requireUser(next = "/"): Promise<Session["user"]> {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (next !== "/profile") {
    // Read the saved profile rather than a potentially stale session snapshot.
    const profile = await getProfile(db, session.user.id);
    if (!profile.bio?.trim()) redirect(`/profile?next=${encodeURIComponent(next)}`);
    if (!profile.image?.trim() && !(await organizerPicture(db, session.user.id, next))) {
      redirect(`/profile?next=${encodeURIComponent(next)}`);
    }
  }
  return session.user;
}

/** Only accepts same-site relative paths, so `?next=` can't redirect off-site. */
export function safeNext(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
