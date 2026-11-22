"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { setPasswordFor } from "@/lib/auth";
import { isDomainError } from "@/server/errors";
import * as groups from "@/server/groups";
import { pathFromUrl } from "@/server/picture-paths";
import { deletePicture, readUpload, storePicture } from "@/server/pictures";
import { requireUser } from "@/server/session";

export interface ActionState {
  error?: string;
  message?: string;
}

async function actor(next = "/"): Promise<string> {
  return (await requireUser(next)).id;
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

/** Organizer changes show on the Group page and its Settings/Invite pages. */
function revalidateGroup(id: string) {
  revalidatePath(groupPath(id), "layout");
  revalidatePath("/");
}

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
  const me = await actor("/groups/new");
  let id = "";
  const state = await attempt(async () => {
    ({ id } = await groups.createGroup(db, me, readSettings(form)));
  });
  if (state.error) return state;
  // Step 2 of creating a Group: the Invite page.
  revalidateGroup(id);
  redirect(`${groupPath(id)}/invite`);
}

export async function joinAction(code: string): Promise<ActionState> {
  const me = await actor(`/join/${code}`);
  let groupId = "";
  const state = await attempt(async () => {
    ({ groupId } = await groups.joinByCode(db, me, code));
  });
  if (state.error) return state;
  revalidateGroup(groupId);
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
  revalidateGroup(groupId);
  return state;
}

export async function setJoiningAction(groupId: string, open: boolean): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(() => groups.setJoiningOpen(db, me, groupId, open));
  revalidateGroup(groupId);
  return state;
}

export async function resetInviteAction(groupId: string): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    await groups.resetInviteCode(db, me, groupId);
    return "New invite link created. The old one no longer works.";
  });
  revalidateGroup(groupId);
  return state;
}

/** No email recovery (ADR 0004): the Organizer sets a temporary password. */
export async function resetMemberPasswordAction(
  groupId: string,
  memberId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const me = await actor();
  const password = String(form.get("password") ?? "");
  if (password.length < 8 || password.length > 128) {
    return { error: "The temporary password must be 8–128 characters." };
  }
  return attempt(async () => {
    await groups.requireCanResetPassword(db, me, groupId, memberId);
    await setPasswordFor(memberId, password);
    return "Password reset. Tell them the new password; they're signed out everywhere.";
  });
}

export async function setParticipatesAction(
  groupId: string,
  participates: boolean,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(() => groups.setOrganizerParticipates(db, me, groupId, participates));
  revalidateGroup(groupId);
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
  revalidateGroup(groupId);
  return state;
}

export async function removeExclusionAction(
  groupId: string,
  a: string,
  b: string,
): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(() => groups.removeExclusion(db, me, groupId, a, b));
  revalidateGroup(groupId);
  return state;
}

export async function drawAction(groupId: string): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    const out = await groups.runDraw(db, me, groupId);
    return out.isRedraw
      ? "Re-draw done. Tell everyone to open the Group and reveal their new person."
      : "The Draw is done. Tell everyone to open the Group and reveal their person.";
  });
  revalidateGroup(groupId);
  return state;
}

function departureMessage(out: groups.DepartureOutcome): string {
  switch (out.kind) {
    case "patched":
      return "Removed. One Santa has a new person; they'll see it next time they open the Group.";
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
    return departureMessage(await groups.removeMember(db, me, groupId, memberId));
  });
  revalidateGroup(groupId);
  return state;
}

export async function leaveAction(groupId: string): Promise<ActionState> {
  const me = await actor();
  const state = await attempt(async () => {
    await groups.leaveGroup(db, me, groupId);
  });
  if (state.error) return state;
  revalidateGroup(groupId);
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
  revalidateGroup(groupId);
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
  revalidateGroup(groupId);
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
  revalidateGroup(groupId);
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
  revalidateGroup(groupId);
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
  revalidateGroup(groupId);
  return state;
}

export async function revealAction(groupId: string): Promise<groups.RevealView | null> {
  const me = await actor();
  return groups.revealMyAssignment(db, me, groupId);
}
