import "server-only";
import { after } from "next/server";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import type { DepartureOutcome, DrawOutcome } from "./groups";

/** The only three non-auth emails in v1 (see docs/V1-SCOPE.md). */

const revealUrl = (groupId: string) => `${env().BETTER_AUTH_URL}/groups/${groupId}/reveal`;

/** Sends after the response so a slow provider never blocks the Draw. */
function sendLater(messages: Parameters<typeof sendEmail>[0][]) {
  after(async () => {
    const results = await Promise.allSettled(messages.map(sendEmail));
    for (const r of results) {
      if (r.status === "rejected") console.error("[email] send failed:", r.reason);
    }
  });
}

export function notifyDraw(groupId: string, out: DrawOutcome) {
  const url = revealUrl(groupId);
  sendLater(
    out.notify.map((p) => ({
      to: p.email,
      subject: out.isRedraw
        ? `Re-draw: you have a new person in ${out.groupName}`
        : `The Draw for ${out.groupName} is done 🎁`,
      text: out.isRedraw
        ? `Hi ${p.name},\n\nThe Organizer ran a Re-draw for ${out.groupName}. Your previous person no longer applies.\n\nReveal your new person:\n${url}`
        : `Hi ${p.name},\n\nThe Draw for ${out.groupName} is done.\n\nReveal who you're gifting:\n${url}`,
    })),
  );
}

export function notifyDeparture(groupId: string, out: DepartureOutcome) {
  if (out.kind !== "patched") return;
  const s = out.changedSanta;
  sendLater([
    {
      to: s.email,
      subject: `Your person in ${out.groupName} has changed`,
      text: `Hi ${s.name},\n\nSomeone left ${out.groupName}, so you now have a different person to gift.\n\nReveal them:\n${revealUrl(groupId)}`,
    },
  ]);
}
