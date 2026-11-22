import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { assignment, group } from "@/db/schema";
import { validateLoop } from "@/lib/draw";
import type { AppDb } from "./db-types";
import {
  addExclusion,
  createGroup,
  deleteGroup,
  departAllGroups,
  getGroupView,
  myRevealState,
  requireCanResetPassword,
  joinByCode,
  leaveGroup,
  listMyGroups,
  MAX_GROUPS_CREATED,
  removeMember,
  revealMyAssignment,
  runDraw,
  setJoiningOpen,
  setOrganizerParticipates,
  setOverride,
  transferOwnership,
  updateSettings,
  type GroupSettings,
} from "./groups";
import { createTestDb, createUser } from "./test-db";
import { setPicture } from "./profile";

const NOW = new Date("2026-12-01T10:00:00Z");
const settings: GroupSettings = {
  name: "Office Santa",
  currency: "INR",
  budgetMin: 500,
  budgetMax: 1000,
  exchangeDate: "2026-12-24",
};

let db: AppDb;
beforeEach(async () => {
  db = await createTestDb();
});

async function groupWith(n: number) {
  const organizer = await createUser(db, { image: "https://example.test/avatar.webp" });
  const { id, inviteCode } = await createGroup(db, organizer, settings);
  const members = [organizer];
  for (let i = 1; i < n; i++) {
    const m = await createUser(db, { image: "https://example.test/avatar.webp" });
    await joinByCode(db, m, inviteCode, { now: NOW });
    members.push(m);
  }
  return { organizer, groupId: id, inviteCode, members };
}

async function drawn(n: number) {
  const g = await groupWith(n);
  await setJoiningOpen(db, g.organizer, g.groupId, false, { now: NOW });
  await runDraw(db, g.organizer, g.groupId, { now: NOW });
  return g;
}

const assignmentsOf = (groupId: string) =>
  db
    .select({ santaId: assignment.santaId, receiverId: assignment.receiverId })
    .from(assignment)
    .where(eq(assignment.groupId, groupId));

describe("creating and joining", () => {
  it("makes the creator the Organizer and a Member", async () => {
    const { organizer, groupId } = await groupWith(1);
    const view = await getGroupView(db, organizer, groupId, { now: NOW });
    expect(view.isOrganizer).toBe(true);
    expect(view.members.map((m) => m.userId)).toEqual([organizer]);
    expect(view.inviteCode).toMatch(/^[2-9A-Z]{8}$/);
  });

  it("needs no email verification (username + password accounts, ADR 0004)", async () => {
    const u = await createUser(db, { emailVerified: false });
    await expect(createGroup(db, u, settings)).resolves.toMatchObject({ id: expect.any(String) });
    const { inviteCode } = await groupWith(1);
    await expect(joinByCode(db, u, inviteCode, { now: NOW })).resolves.toMatchObject({
      alreadyMember: false,
    });
  });

  it("refuses an account that doesn't exist", async () => {
    await expect(createGroup(db, "ghost", settings)).rejects.toMatchObject({ code: "not-found" });
  });

  it("limits Groups created per user", async () => {
    const u = await createUser(db);
    for (let i = 0; i < MAX_GROUPS_CREATED; i++) await createGroup(db, u, settings);
    await expect(createGroup(db, u, settings)).rejects.toMatchObject({ code: "limit" });
  });

  it("validates the Budget", async () => {
    const u = await createUser(db);
    await expect(
      createGroup(db, u, { ...settings, budgetMin: 2000, budgetMax: 1000 }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("joining twice is harmless; joining a closed Group is refused", async () => {
    const { organizer, groupId, inviteCode, members } = await groupWith(2);
    expect(await joinByCode(db, members[1], inviteCode.toLowerCase())).toMatchObject({
      alreadyMember: true,
    });
    await setJoiningOpen(db, organizer, groupId, false, { now: NOW });
    const late = await createUser(db);
    await expect(joinByCode(db, late, inviteCode, { now: NOW })).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("non-Members can't see the Group", async () => {
    const { groupId } = await groupWith(2);
    const stranger = await createUser(db);
    await expect(getGroupView(db, stranger, groupId)).rejects.toMatchObject({
      code: "not-found",
    });
  });
});

describe("the Draw", () => {
  it("requires joining to be closed and at least 3 participants", async () => {
    const g = await groupWith(3);
    await expect(runDraw(db, g.organizer, g.groupId, { now: NOW })).rejects.toMatchObject({
      code: "conflict",
    });
    await setJoiningOpen(db, g.organizer, g.groupId, false, { now: NOW });
    await setOrganizerParticipates(db, g.organizer, g.groupId, false);
    await expect(runDraw(db, g.organizer, g.groupId, { now: NOW })).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("only the Organizer can draw", async () => {
    const g = await groupWith(3);
    await setJoiningOpen(db, g.organizer, g.groupId, false, { now: NOW });
    await expect(runDraw(db, g.members[1], g.groupId, { now: NOW })).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("stores a valid single loop that respects Exclusions", async () => {
    const g = await groupWith(6);
    await addExclusion(db, g.organizer, g.groupId, g.members[1], g.members[2]);
    await setJoiningOpen(db, g.organizer, g.groupId, false, { now: NOW });
    const out = await runDraw(db, g.organizer, g.groupId, { now: NOW });
    expect(out.isRedraw).toBe(false);
    expect(out.participants).toBe(6);
    const rows = await assignmentsOf(g.groupId);
    expect(
      validateLoop(g.members, rows, [[g.members[1], g.members[2]]]),
    ).toEqual([]);
  });

  it("blocks Draw without pictures and uses an organizer's replacement on the reveal card", async () => {
    const g = await groupWith(3);
    const member = g.members[1];
    await setPicture(db, member, null);
    await setJoiningOpen(db, g.organizer, g.groupId, false, { now: NOW });
    await expect(runDraw(db, g.organizer, g.groupId, { now: NOW })).rejects.toMatchObject({ code: "invalid" });
    expect(await assignmentsOf(g.groupId)).toHaveLength(0);

    const replacement = "https://example.test/group-picture.webp";
    await setOverride(db, g.organizer, g.groupId, member, { pictureOverrideUrl: replacement });
    await runDraw(db, g.organizer, g.groupId, { now: NOW });
    const rows = await assignmentsOf(g.groupId);
    const santa = rows.find((row) => row.receiverId === member)!.santaId;
    expect((await revealMyAssignment(db, santa, g.groupId))?.receiver.image).toBe(replacement);

    await setOverride(db, g.organizer, g.groupId, member, { pictureOverrideUrl: null });
    await expect(runDraw(db, g.organizer, g.groupId, { now: NOW })).rejects.toMatchObject({ code: "invalid" });
    expect(await assignmentsOf(g.groupId)).toEqual(rows);
  });

  it("does not require a picture from an opted-out organizer", async () => {
    const g = await groupWith(4);
    await setPicture(db, g.organizer, null);
    await setOrganizerParticipates(db, g.organizer, g.groupId, false);
    await setJoiningOpen(db, g.organizer, g.groupId, false, { now: NOW });
    await expect(runDraw(db, g.organizer, g.groupId, { now: NOW })).resolves.toMatchObject({ participants: 3 });
  });

  it("leaves an opted-out Organizer out of the loop", async () => {
    const g = await groupWith(4);
    await setOrganizerParticipates(db, g.organizer, g.groupId, false);
    await setJoiningOpen(db, g.organizer, g.groupId, false, { now: NOW });
    await runDraw(db, g.organizer, g.groupId, { now: NOW });
    const rows = await assignmentsOf(g.groupId);
    expect(validateLoop(g.members.slice(1), rows)).toEqual([]);
  });

  it("requires an Exchange Date", async () => {
    const g = await groupWith(3);
    await updateSettings(db, g.organizer, g.groupId, { ...settings, exchangeDate: null }, { now: NOW });
    await setJoiningOpen(db, g.organizer, g.groupId, false, { now: NOW });
    await expect(runDraw(db, g.organizer, g.groupId, { now: NOW })).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("allows a Re-draw until the Exchange Date, not after", async () => {
    const g = await drawn(4);
    const again = await runDraw(db, g.organizer, g.groupId, { now: NOW });
    expect(again.isRedraw).toBe(true);
    await expect(
      runDraw(db, g.organizer, g.groupId, { now: new Date("2026-12-25T00:00:00Z") }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("privacy", () => {
  it("the Organizer's view never contains Assignments", async () => {
    const g = await drawn(4);
    const view = await getGroupView(db, g.organizer, g.groupId, { now: NOW });
    const json = JSON.stringify(view);
    // Check keys, not values (the Group name itself contains "Santa").
    expect(json).not.toMatch(/"\w*(receiver|santa)\w*":/i);
    expect(view.members.every((m) => m.revealed === false)).toBe(true);
  });

  it("Members don't see revealed status, the invite code, or Exclusions", async () => {
    const g = await drawn(3);
    const view = await getGroupView(db, g.members[1], g.groupId, { now: NOW });
    expect(view.inviteCode).toBeUndefined();
    expect(view.exclusions).toBeUndefined();
    expect(view.members.every((m) => m.revealed === undefined)).toBe(true);
  });

  it("Reveal shows the Santa their receiver and marks revealed", async () => {
    const g = await drawn(3);
    const santa = g.members[1];
    const rows = await assignmentsOf(g.groupId);
    const receiverId = rows.find((r) => r.santaId === santa)!.receiverId;

    const reveal = await revealMyAssignment(db, santa, g.groupId, { now: NOW });
    expect(reveal?.receiver.name).toBe(`User ${receiverId}`);
    expect(reveal?.receiver).not.toHaveProperty("song");
    const orgView = await getGroupView(db, g.organizer, g.groupId, { now: NOW });
    expect(orgView.members.find((m) => m.userId === santa)?.revealed).toBe(true);
  });

  it("Overrides apply in this Group only", async () => {
    const g = await groupWith(2);
    await setOverride(db, g.organizer, g.groupId, g.members[1], {
      pictureOverrideUrl: "https://example.test/x.webp",
      bioHidden: true,
    });
    const view = await getGroupView(db, g.members[1], g.groupId);
    const m = view.members.find((x) => x.userId === g.members[1])!;
    expect(m.image).toBe("https://example.test/x.webp");
    expect(m.hasPictureOverride).toBe(true);
    expect(m.bio).toBeNull();
  });
});

describe("leaving after the Draw", () => {
  it("patches the loop and makes the affected Santa reveal again", async () => {
    const g = await drawn(5);
    const leaver = g.members[3];
    const santaOfLeaver = (await assignmentsOf(g.groupId)).find(
      (r) => r.receiverId === leaver,
    )!.santaId;
    await revealMyAssignment(db, santaOfLeaver, g.groupId, { now: NOW });
    const out = await leaveGroup(db, leaver, g.groupId);
    expect(out).toEqual({ kind: "patched", changedSantaId: santaOfLeaver });
    // No email: the app shows "Reveal my person" again instead.
    expect(await myRevealState(db, santaOfLeaver, g.groupId)).toEqual({
      hasAssignment: true,
      revealed: false,
    });
    const rest = g.members.filter((m) => m !== leaver);
    expect(validateLoop(rest, await assignmentsOf(g.groupId))).toEqual([]);
  });

  it("flags a Re-draw when the patch would break an Exclusion", async () => {
    const g = await drawn(5);
    const rows = await assignmentsOf(g.groupId);
    const leaver = g.members[2];
    const s = rows.find((r) => r.receiverId === leaver)!.santaId;
    const r = rows.find((x) => x.santaId === leaver)!.receiverId;
    await addExclusion(db, g.organizer, g.groupId, s, r);
    const out = await removeMember(db, g.organizer, g.groupId, leaver);
    expect(out.kind).toBe("needs-redraw");
    const view = await getGroupView(db, g.organizer, g.groupId, { now: NOW });
    expect(view.needsRedraw).toBe(true);
    await runDraw(db, g.organizer, g.groupId, { now: NOW });
    expect((await getGroupView(db, g.organizer, g.groupId, { now: NOW })).needsRedraw).toBe(false);
  });

  it("clears the Draw when only one Member is left", async () => {
    const g = await drawn(3);
    await removeMember(db, g.organizer, g.groupId, g.members[1]);
    const out = await removeMember(db, g.organizer, g.groupId, g.members[2]);
    expect(out.kind).toBe("cleared");
    const [row] = await db.select().from(group).where(eq(group.id, g.groupId));
    expect(row.status).toBe("joining_closed");
    expect(await assignmentsOf(g.groupId)).toEqual([]);
  });

  it("the Organizer can't leave without transferring ownership", async () => {
    const g = await drawn(3);
    await expect(leaveGroup(db, g.organizer, g.groupId)).rejects.toMatchObject({
      code: "conflict",
    });
    await transferOwnership(db, g.organizer, g.groupId, g.members[1]);
    await expect(leaveGroup(db, g.organizer, g.groupId)).resolves.toMatchObject({
      kind: "patched",
    });
  });

  it("account deletion leaves every Group, but not while organising", async () => {
    const g = await drawn(4);
    await expect(departAllGroups(db, g.organizer)).rejects.toMatchObject({ code: "conflict" });
    const results = await departAllGroups(db, g.members[2]);
    expect(results).toHaveLength(1);
    expect(await listMyGroups(db, g.members[2])).toEqual([]);
  });
});

describe("Organizer password reset (no email recovery)", () => {
  it("lets the Organizer reset a Member of their own Group", async () => {
    const g = await groupWith(3);
    await expect(
      requireCanResetPassword(db, g.organizer, g.groupId, g.members[1]),
    ).resolves.toBeUndefined();
  });

  it("refuses non-Organizers, self-resets, and people outside the Group", async () => {
    const g = await groupWith(3);
    const outsider = await createUser(db);
    await expect(
      requireCanResetPassword(db, g.members[1], g.groupId, g.members[2]),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      requireCanResetPassword(db, g.organizer, g.groupId, g.organizer),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      requireCanResetPassword(db, g.organizer, g.groupId, outsider),
    ).rejects.toMatchObject({ code: "not-found" });
  });
});

describe("archive and delete", () => {
  it("an archived Group is read-only", async () => {
    const g = await groupWith(3);
    const later = new Date("2027-02-01T00:00:00Z");
    await expect(
      setJoiningOpen(db, g.organizer, g.groupId, false, { now: later }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect((await listMyGroups(db, g.organizer, { now: later }))[0].archived).toBe(true);
  });

  it("deleting requires the exact name", async () => {
    const g = await groupWith(2);
    await expect(deleteGroup(db, g.organizer, g.groupId, "wrong")).rejects.toMatchObject({
      code: "invalid",
    });
    await deleteGroup(db, g.organizer, g.groupId, "Office Santa");
    expect(await listMyGroups(db, g.organizer)).toEqual([]);
  });
});
