"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { isDomainError } from "@/server/errors";
import * as groups from "@/server/groups";
import { notifyDeparture, notifyDraw, notifyInvites } from "@/server/notifications";
import { pathFromUrl } from "@/server/picture-paths";
import { deletePicture, readUpload, storePicture } from "@/server/pictures";

export interface ActionState {
  error?: string;
  message?: string;
}

async function actor(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user.id;
}

/** Turns expected DomainErrors into a form message; anything else throws. */
async function attempt(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return message ? { message } : {};
  } catch (e) {
    if (isDomainError(e)) return { error: e.message };
    throw e;
  }
}

const groupPath = (id: string) => `/groups/${id}`;

function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function readSettings(form: FormData): groups.GroupSettings {
  const exchangeDate = String(form.get("exchangeDate") ?? "").trim();
  return {
    name: String(form.get("name") ?? ""),
    currency: String(form.get("currency") ?? "INR") as groups.Currency,
    budgetMin: intOrNull(form.get("budgetMin")),
    budgetMax: intOrNull(form.get("budgetMax")),
    exchangeDate: exchangeDate === "" ? null : exchangeDate,
  };
}

// ---------------------------------------------------------------------------

export async function createGroupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  let id = "";
  const state = await attempt(async () => {
    ({ id } = await groups.createGroup(db, me, readSettings(form)));
  });
  if (state.error) return state;
  redirect(groupPath(id));
}

export async function joinAction(code: string): Promise<ActionState> {
  const me = await actor();
  let groupId = "";
  const state = await attempt(async () => {
    ({ groupId } = await groups.joinByCode(db, me, code));
  });
  if (state.error) return state;
  redirect(groupPath(groupId));
}

export async function goToJoinAction(_: ActionState, form: FormData): Promise<ActionState> {
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return { error: "That code doesn't look right." };
  redirect(`/join/${code}`);
}

export async function updateSettingsAction(
  groupId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    await groups.updateSettings(db, me, groupId, readSettings(form));
    return "Saved.";
  });
  revalidatePath(groupPath(groupId));
  return state;
}

export async function setJoiningAction(groupId: string, open: boolean): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(() => groups.setJoiningOpen(db, me, groupId, open));
  revalidatePath(groupPath(groupId));
  return state;
}

export async function resetInviteAction(groupId: string): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    await groups.resetInviteCode(db, me, groupId);
    return "New invite link created. The old one no longer works.";
  });
  revalidatePath(groupPath(groupId));
  return state;
}

export async function inviteByEmailAction(
  groupId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const me = await actor();
  return attempt(async () => {
    const emails = groups.parseInviteEmails(String(form.get("emails") ?? ""));
    notifyInvites(await groups.getInviteContext(db, me, groupId), emails);
    return `Invite sent to ${emails.length} ${emails.length === 1 ? "person" : "people"}.`;
  });
}

export async function setParticipatesAction(
  groupId: string,
  participates: boolean,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(() => groups.setOrganizerParticipates(db, me, groupId, participates));
  revalidatePath(groupPath(groupId));
  return state;
}

export async function addExclusionAction(
  groupId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(() =>
    groups.addExclusion(db, me, groupId, String(form.get("a")), String(form.get("b"))),
  );
  revalidatePath(groupPath(groupId));
  return state;
}

export async function removeExclusionAction(
  groupId: string,
  a: string,
  b: string,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(() => groups.removeExclusion(db, me, groupId, a, b));
  revalidatePath(groupPath(groupId));
  return state;
}

export async function drawAction(groupId: string): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    const out = await groups.runDraw(db, me, groupId);
    notifyDraw(groupId, out);
    return out.isRedraw
      ? "Re-draw done. Everyone has been emailed."
      : "The Draw is done. Everyone has been emailed.";
  });
  revalidatePath(groupPath(groupId));
  return state;
}

function departureMessage(out: groups.DepartureOutcome): string {
  switch (out.kind) {
    case "patched":
      return "Removed. One Santa has a new person and has been emailed.";
    case "cleared":
      return "Removed. Too few Members remain, so the Draw was cleared.";
    case "needs-redraw":
      return "Removed. Closing the gap would break an Exclusion: run a Re-draw.";
    case "left":
      return "Removed.";
  }
}

export async function removeMemberAction(groupId: string, memberId: string): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    const out = await groups.removeMember(db, me, groupId, memberId);
    notifyDeparture(groupId, out);
    return departureMessage(out);
  });
  revalidatePath(groupPath(groupId));
  return state;
}

export async function leaveAction(groupId: string): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    notifyDeparture(groupId, await groups.leaveGroup(db, me, groupId));
  });
  if (state.error) return state;
  redirect("/");
}

export async function transferAction(
  groupId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    await groups.transferOwnership(db, me, groupId, String(form.get("to")));
    return "Ownership transferred.";
  });
  revalidatePath(groupPath(groupId));
  return state;
}

export async function deleteGroupAction(
  groupId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(() =>
    groups.deleteGroup(db, me, groupId, String(form.get("confirmName") ?? "")),
  );
  if (state.error) return state;
  redirect("/");
}

export async function setBioHiddenAction(
  groupId: string,
  memberId: string,
  hidden: boolean,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    await groups.setOverride(db, me, groupId, memberId, { bioHidden: hidden });
  });
  revalidatePath(groupPath(groupId));
  return state;
}

export async function uploadOverridePictureAction(
  groupId: string,
  memberId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    // Check permission before storing anything.
    await groups.setOverride(db, me, groupId, memberId, {});
    const url = await storePicture(
      { userId: memberId, groupId },
      await readUpload(form.get("picture")),
    );
    const { previousPictureOverrideUrl } = await groups.setOverride(db, me, groupId, memberId, {
      pictureOverrideUrl: url,
    });
    await deletePicture(pathFromUrl(previousPictureOverrideUrl));
    return "Picture replaced in this Group.";
  });
  revalidatePath(groupPath(groupId));
  return state;
}

export async function clearOverridePictureAction(
  groupId: string,
  memberId: string,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    const { previousPictureOverrideUrl } = await groups.setOverride(db, me, groupId, memberId, {
      pictureOverrideUrl: null,
    });
    await deletePicture(pathFromUrl(previousPictureOverrideUrl));
  });
  revalidatePath(groupPath(groupId));
  return state;
}

export async function revealAction(groupId: string): Promise<groups.RevealView | null> {
  const me = await actor();
  return groups.revealMyAssignment(db, me, groupId);
}
