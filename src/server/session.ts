import "server-only";
import { redirect } from "next/navigation";
import { getSession, type Session } from "@/lib/auth";

/** The signed-in user, or a redirect to sign-in that comes back to `next`. */
export async function requireUser(next = "/"): Promise<Session["user"]> {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return session.user;
}

/** Only accepts same-site relative paths, so `?next=` can't redirect off-site. */
export function safeNext(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
