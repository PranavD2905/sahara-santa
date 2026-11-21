import { and, asc, count, eq, isNull, or } from "drizzle-orm";
import { customAlphabet, nanoid } from "nanoid";
import {
  assignment,
  exclusion,
  group,
  groupMember,
  user,
} from "@/db/schema";
import {
  draw,
  patch,
  type Assignment,
  type DrawError,
  type Exclusion,
  type RandomInt,
} from "@/lib/draw";
import { isArchived, isBeforeOrOnExchange, isValidDay } from "./dates";
import type { AppDb, Tx } from "./db-types";
import { DomainError } from "./errors";

export const MAX_MEMBERS = 50;
export const MAX_GROUPS_CREATED = 10;
export const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** No 0/O/1/I/L so codes read cleanly aloud. */
const inviteCode = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 8);

export interface Options {
  now?: Date;
  rand?: RandomInt;
}

type GroupRow = typeof group.$inferSelect;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Accounts are username + password with no verification step (ADR 0004). */
async function requireAccount(db: AppDb | Tx, userId: string) {
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId));
  if (!u) throw new DomainError("not-found", "Account not found.");
}

/** Locks the Group row for the rest of the transaction. */
async function lockGroup(tx: Tx, groupId: string): Promise<GroupRow> {
  const [g] = await tx
    .select()
    .from(group)
    .where(eq(group.id, groupId))
    .for("update");
  if (!g) throw new DomainError("not-found", "Group not found.");
  return g;
}

function requireOrganizer(g: GroupRow, actorId: string) {
  if (g.organizerId !== actorId) {
    throw new DomainError("forbidden", "Only the Organizer can do that.");
  }
}

function requireNotArchived(g: GroupRow, now: Date) {
  if (isArchived(g.exchangeDate, now)) {
    throw new DomainError("conflict", "This Group is archived and read-only.");
  }
}

async function isMember(db: AppDb | Tx, groupId: string, userId: string) {
  const [m] = await db
    .select({ userId: groupMember.userId })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)));
  return Boolean(m);
}

// ---------------------------------------------------------------------------
// Settings validation
// ---------------------------------------------------------------------------

export interface GroupSettings {
  name: string;
  currency: Currency;
  budgetMin: number | null;
  budgetMax: number | null;
  exchangeDate: string | null;
}

function validateSettings(s: GroupSettings): GroupSettings {
  const name = s.name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new DomainError("invalid", "Name must be 1–80 characters.");
  }
  if (!CURRENCIES.includes(s.currency)) {
    throw new DomainError("invalid", "Unsupported currency.");
  }
  for (const v of [s.budgetMin, s.budgetMax]) {
    if (v !== null && (!Number.isInteger(v) || v <= 0)) {
      throw new DomainError("invalid", "Budget amounts must be positive whole numbers.");
    }
  }
  if (s.budgetMin !== null && s.budgetMax !== null && s.budgetMin > s.budgetMax) {
    throw new DomainError("invalid", "Budget minimum can't be above the maximum.");
  }
  if (s.exchangeDate !== null && !isValidDay(s.exchangeDate)) {
    throw new DomainError("invalid", "Exchange Date must be a valid date.");
  }
  return { ...s, name };
}

// ---------------------------------------------------------------------------
// Create, join, settings
// ---------------------------------------------------------------------------

export async function createGroup(
  db: AppDb,
  actorId: string,
  settings: GroupSettings,
): Promise<{ id: string; inviteCode: string }> {
  const s = validateSettings(settings);
  return db.transaction(async (tx) => {
    await requireAccount(tx, actorId);
    const [{ n }] = await tx
      .select({ n: count() })
      .from(group)
      .where(eq(group.organizerId, actorId));
    if (n >= MAX_GROUPS_CREATED) {
      throw new DomainError("limit", `You can organise at most ${MAX_GROUPS_CREATED} Groups.`);
    }
    const id = nanoid();
    const code = inviteCode();
    await tx.insert(group).values({ id, organizerId: actorId, inviteCode: code, ...s });
    await tx.insert(groupMember).values({ groupId: id, userId: actorId });
    return { id, inviteCode: code };
  });
}

export async function joinByCode(
  db: AppDb,
  actorId: string,
  code: string,
  opts: Options = {},
): Promise<{ groupId: string; alreadyMember: boolean }> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    await requireAccount(tx, actorId);
    const [found] = await tx
      .select({ id: group.id })
      .from(group)
      .where(eq(group.inviteCode, code.trim().toUpperCase()));
    if (!found) throw new DomainError("not-found", "That invite link isn't valid.");
    const g = await lockGroup(tx, found.id);

    if (await isMember(tx, g.id, actorId)) {
      return { groupId: g.id, alreadyMember: true };
    }
    requireNotArchived(g, now);
    if (g.status !== "open") {
      throw new DomainError("conflict", "Joining is closed for this Group.");
    }
    const [{ n }] = await tx
      .select({ n: count() })
      .from(groupMember)
      .where(eq(groupMember.groupId, g.id));
    if (n >= MAX_MEMBERS) {
      throw new DomainError("limit", `This Group is full (${MAX_MEMBERS} Members).`);
    }
    await tx.insert(groupMember).values({ groupId: g.id, userId: actorId });
    return { groupId: g.id, alreadyMember: false };
  });
}

export async function updateSettings(
  db: AppDb,
  actorId: string,
  groupId: string,
  settings: GroupSettings,
  opts: Options = {},
): Promise<void> {
  const s = validateSettings(settings);
  const now = opts.now ?? new Date();
  await db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    requireNotArchived(g, now);
    if (g.status === "drawn" && s.exchangeDate === null) {
      throw new DomainError("invalid", "A drawn Group needs an Exchange Date.");
    }
    await tx
      .update(group)
      .set({ ...s, updatedAt: now })
      .where(eq(group.id, groupId));
  });
}

/** Close joining (open → joining_closed) or reopen it before the Draw. */
export async function setJoiningOpen(
  db: AppDb,
  actorId: string,
  groupId: string,
  open: boolean,
  opts: Options = {},
): Promise<void> {
  const now = opts.now ?? new Date();
  await db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    requireNotArchived(g, now);
    if (g.status === "drawn") {
      throw new DomainError("conflict", "Joining can't be reopened after the Draw.");
    }
    await tx
      .update(group)
      .set({ status: open ? "open" : "joining_closed", updatedAt: now })
      .where(eq(group.id, groupId));
  });
}

export async function resetInviteCode(
  db: AppDb,
  actorId: string,
  groupId: string,
): Promise<string> {
  return db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    const code = inviteCode();
    await tx.update(group).set({ inviteCode: code }).where(eq(group.id, groupId));
    return code;
  });
}

/** The Organizer may opt out of giving/receiving, only before the Draw. */
export async function setOrganizerParticipates(
  db: AppDb,
  actorId: string,
  groupId: string,
  participates: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    if (g.status === "drawn") {
      throw new DomainError("conflict", "Participation can't change after the Draw.");
    }
    await tx
      .update(groupMember)
      .set({ participates })
      .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, actorId)));
  });
}

// ---------------------------------------------------------------------------
// Exclusions
// ---------------------------------------------------------------------------

const ordered = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export async function addExclusion(
  db: AppDb,
  actorId: string,
  groupId: string,
  a: string,
  b: string,
): Promise<void> {
  if (a === b) throw new DomainError("invalid", "Pick two different Members.");
  await db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    if (!(await isMember(tx, groupId, a)) || !(await isMember(tx, groupId, b))) {
      throw new DomainError("invalid", "Both people must be Members of this Group.");
    }
    const [memberA, memberB] = ordered(a, b);
    await tx
      .insert(exclusion)
      .values({ groupId, memberA, memberB })
      .onConflictDoNothing();
  });
}

export async function removeExclusion(
  db: AppDb,
  actorId: string,
  groupId: string,
  a: string,
  b: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    const [memberA, memberB] = ordered(a, b);
    await tx
      .delete(exclusion)
      .where(
        and(
          eq(exclusion.groupId, groupId),
          eq(exclusion.memberA, memberA),
          eq(exclusion.memberB, memberB),
        ),
      );
  });
}

async function loadExclusions(db: AppDb | Tx, groupId: string): Promise<Exclusion[]> {
  const rows = await db
    .select({ a: exclusion.memberA, b: exclusion.memberB })
    .from(exclusion)
    .where(eq(exclusion.groupId, groupId));
  return rows.map((r) => [r.a, r.b] as const);
}

// ---------------------------------------------------------------------------
// Draw and Re-draw
// ---------------------------------------------------------------------------

export interface DrawOutcome {
  isRedraw: boolean;
  /** How many people were placed in the loop. */
  participants: number;
}

export function describeDrawError(e: DrawError): string {
  switch (e.kind) {
    case "too-few-members":
      return `A Draw needs at least ${e.need} participating Members (you have ${e.have}).`;
    case "duplicate-members":
      return "Something is wrong with the member list. Please try again.";
    case "member-over-excluded":
      return "One Member is excluded from too many people to be placed in the loop. Remove some Exclusions.";
    case "no-valid-loop":
      return e.proven
        ? "These Exclusions make a Draw impossible. Remove some and try again."
        : "Couldn't find a Draw that fits these Exclusions. Try removing some.";
  }
}

export async function runDraw(
  db: AppDb,
  actorId: string,
  groupId: string,
  opts: Options = {},
): Promise<DrawOutcome> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    requireNotArchived(g, now);

    const isRedraw = g.status === "drawn";
    if (g.status === "open") {
      throw new DomainError("conflict", "Close joining before the Draw.");
    }
    if (!g.exchangeDate) {
      throw new DomainError("invalid", "Set an Exchange Date before the Draw.");
    }
    if (isRedraw && !isBeforeOrOnExchange(g.exchangeDate, now)) {
      throw new DomainError("conflict", "Re-draw is only allowed until the Exchange Date.");
    }

    const participants = await tx
      .select({ userId: groupMember.userId })
      .from(groupMember)
      .where(and(eq(groupMember.groupId, groupId), eq(groupMember.participates, true)));

    const result = draw(
      participants.map((p) => p.userId),
      await loadExclusions(tx, groupId),
      opts.rand,
    );
    if (!result.ok) throw new DomainError("invalid", describeDrawError(result.error));

    await tx.delete(assignment).where(eq(assignment.groupId, groupId));
    await tx
      .insert(assignment)
      .values(result.assignments.map((a) => ({ groupId, ...a, createdAt: now })));
    await tx
      .update(groupMember)
      .set({ revealedAt: null })
      .where(eq(groupMember.groupId, groupId));
    await tx
      .update(group)
      .set({ status: "drawn", drawnAt: now, needsRedraw: false, updatedAt: now })
      .where(eq(group.id, groupId));

    return { isRedraw, participants: participants.length };
  });
}

// ---------------------------------------------------------------------------
// Leaving, removal, Patch
// ---------------------------------------------------------------------------

export type DepartureOutcome =
  | { kind: "left" }
  | {
      kind: "patched";
      /** The Santa whose receiver changed; they see "Reveal my person" again. */
      changedSantaId: string;
    }
  | { kind: "cleared" }
  | { kind: "needs-redraw" };

/**
 * Removes `leaverId` from the Group and keeps the loop intact (ADR 0001).
 * Runs inside the caller's transaction with the Group row already locked.
 */
async function depart(tx: Tx, g: GroupRow, leaverId: string): Promise<DepartureOutcome> {
  const rows: Assignment[] = await tx
    .select({ santaId: assignment.santaId, receiverId: assignment.receiverId })
    .from(assignment)
    .where(eq(assignment.groupId, g.id));

  let outcome: DepartureOutcome = { kind: "left" };
  const inLoop = rows.some((r) => r.santaId === leaverId || r.receiverId === leaverId);

  if (g.status === "drawn" && inLoop) {
    const result = patch(rows, leaverId, await loadExclusions(tx, g.id));
    switch (result.kind) {
      case "patched": {
        await tx
          .delete(assignment)
          .where(
            and(
              eq(assignment.groupId, g.id),
              or(eq(assignment.santaId, leaverId), eq(assignment.receiverId, leaverId)),
            ),
          );
        const link = result.assignments.find((a) => a.santaId === result.changedSantaId)!;
        await tx.insert(assignment).values({ groupId: g.id, ...link });
        // Their receiver changed, so they should Reveal again.
        await tx
          .update(groupMember)
          .set({ revealedAt: null })
          .where(
            and(eq(groupMember.groupId, g.id), eq(groupMember.userId, link.santaId)),
          );
        outcome = { kind: "patched", changedSantaId: link.santaId };
        break;
      }
      case "cleared":
        await tx.delete(assignment).where(eq(assignment.groupId, g.id));
        await tx
          .update(group)
          .set({ status: "joining_closed", drawnAt: null, needsRedraw: false })
          .where(eq(group.id, g.id));
        outcome = { kind: "cleared" };
        break;
      case "needs-redraw":
        // The leaver's Santa is left without a receiver until a Re-draw.
        await tx
          .delete(assignment)
          .where(
            and(
              eq(assignment.groupId, g.id),
              or(eq(assignment.santaId, leaverId), eq(assignment.receiverId, leaverId)),
            ),
          );
        await tx.update(group).set({ needsRedraw: true }).where(eq(group.id, g.id));
        outcome = { kind: "needs-redraw" };
        break;
      case "not-a-member":
        break;
    }
  }

  await tx
    .delete(exclusion)
    .where(
      and(
        eq(exclusion.groupId, g.id),
        or(eq(exclusion.memberA, leaverId), eq(exclusion.memberB, leaverId)),
      ),
    );
  await tx
    .delete(groupMember)
    .where(and(eq(groupMember.groupId, g.id), eq(groupMember.userId, leaverId)));
  return outcome;
}

export async function leaveGroup(
  db: AppDb,
  actorId: string,
  groupId: string,
): Promise<DepartureOutcome> {
  return db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    if (g.organizerId === actorId) {
      throw new DomainError(
        "conflict",
        "Transfer ownership or delete the Group before leaving.",
      );
    }
    if (!(await isMember(tx, groupId, actorId))) {
      throw new DomainError("not-found", "You're not in this Group.");
    }
    return depart(tx, g, actorId);
  });
}

export async function removeMember(
  db: AppDb,
  actorId: string,
  groupId: string,
  memberId: string,
): Promise<DepartureOutcome> {
  return db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    if (memberId === actorId) {
      throw new DomainError("invalid", "You can't remove yourself as Organizer.");
    }
    if (!(await isMember(tx, groupId, memberId))) {
      throw new DomainError("not-found", "That person isn't in this Group.");
    }
    return depart(tx, g, memberId);
  });
}

/**
 * Removes the user from every Group they belong to (account deletion).
 * Fails if they still organise any Group.
 */
export async function departAllGroups(
  db: AppDb,
  userId: string,
): Promise<{ groupId: string; outcome: DepartureOutcome }[]> {
  return db.transaction(async (tx) => {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(group)
      .where(eq(group.organizerId, userId));
    if (n > 0) {
      throw new DomainError(
        "conflict",
        "Transfer ownership of, or delete, the Groups you organise first.",
      );
    }
    const memberships = await tx
      .select({ groupId: groupMember.groupId })
      .from(groupMember)
      .where(eq(groupMember.userId, userId));
    const results = [];
    for (const { groupId } of memberships) {
      const g = await lockGroup(tx, groupId);
      results.push({ groupId, outcome: await depart(tx, g, userId) });
    }
    return results;
  });
}

// ---------------------------------------------------------------------------
// Ownership and deletion
// ---------------------------------------------------------------------------

export async function transferOwnership(
  db: AppDb,
  actorId: string,
  groupId: string,
  newOrganizerId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    if (newOrganizerId === actorId) return;
    if (!(await isMember(tx, groupId, newOrganizerId))) {
      throw new DomainError("invalid", "The new Organizer must be a Member.");
    }
    const [{ n }] = await tx
      .select({ n: count() })
      .from(group)
      .where(eq(group.organizerId, newOrganizerId));
    if (n >= MAX_GROUPS_CREATED) {
      throw new DomainError("limit", "That Member already organises the maximum number of Groups.");
    }
    await tx.update(group).set({ organizerId: newOrganizerId }).where(eq(group.id, groupId));
  });
}

export async function deleteGroup(
  db: AppDb,
  actorId: string,
  groupId: string,
  confirmName: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    if (confirmName.trim() !== g.name) {
      throw new DomainError("invalid", "Type the Group's name exactly to delete it.");
    }
    await tx.delete(group).where(eq(group.id, groupId));
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface MemberView {
  userId: string;
  name: string;
  /** Override if set, else Profile Picture, else null (initials). */
  image: string | null;
  bio: string | null;
  hasPictureOverride: boolean;
  bioHidden: boolean;
  participates: boolean;
  isOrganizer: boolean;
  /** Only filled for the Organizer's view. */
  revealed?: boolean;
}

export interface GroupView {
  id: string;
  name: string;
  status: GroupRow["status"];
  archived: boolean;
  needsRedraw: boolean;
  currency: Currency;
  budgetMin: number | null;
  budgetMax: number | null;
  exchangeDate: string | null;
  isOrganizer: boolean;
  /** Only for the Organizer. */
  inviteCode?: string;
  exclusions?: Exclusion[];
  members: MemberView[];
}

/**
 * The Group as one Member sees it. Never includes Assignments (ADR 0002).
 */
export async function getGroupView(
  db: AppDb,
  actorId: string,
  groupId: string,
  opts: Options = {},
): Promise<GroupView> {
  const now = opts.now ?? new Date();
  const [g] = await db.select().from(group).where(eq(group.id, groupId));
  if (!g || !(await isMember(db, groupId, actorId))) {
    throw new DomainError("not-found", "Group not found.");
  }
  const isOrganizer = g.organizerId === actorId;
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      bio: user.bio,
      pictureOverrideUrl: groupMember.pictureOverrideUrl,
      bioHidden: groupMember.bioHidden,
      participates: groupMember.participates,
      revealedAt: groupMember.revealedAt,
    })
    .from(groupMember)
    .innerJoin(user, eq(user.id, groupMember.userId))
    .where(eq(groupMember.groupId, groupId))
    .orderBy(asc(groupMember.joinedAt));

  return {
    id: g.id,
    name: g.name,
    status: g.status,
    archived: isArchived(g.exchangeDate, now),
    needsRedraw: g.needsRedraw,
    currency: g.currency,
    budgetMin: g.budgetMin,
    budgetMax: g.budgetMax,
    exchangeDate: g.exchangeDate,
    isOrganizer,
    ...(isOrganizer
      ? { inviteCode: g.inviteCode, exclusions: await loadExclusions(db, groupId) }
      : {}),
    members: rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      image: r.pictureOverrideUrl ?? r.image,
      bio: r.bioHidden ? null : r.bio,
      hasPictureOverride: r.pictureOverrideUrl !== null,
      bioHidden: r.bioHidden,
      participates: r.participates,
      isOrganizer: r.userId === g.organizerId,
      ...(isOrganizer && g.status === "drawn" ? { revealed: r.revealedAt !== null } : {}),
    })),
  };
}

export interface MyGroupSummary {
  id: string;
  name: string;
  status: GroupRow["status"];
  exchangeDate: string | null;
  isOrganizer: boolean;
  archived: boolean;
}

export async function listMyGroups(
  db: AppDb,
  actorId: string,
  opts: Options = {},
): Promise<MyGroupSummary[]> {
  const now = opts.now ?? new Date();
  const rows = await db
    .select({
      id: group.id,
      name: group.name,
      status: group.status,
      exchangeDate: group.exchangeDate,
      organizerId: group.organizerId,
    })
    .from(groupMember)
    .innerJoin(group, eq(group.id, groupMember.groupId))
    .where(eq(groupMember.userId, actorId))
    .orderBy(asc(group.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    exchangeDate: r.exchangeDate,
    isOrganizer: r.organizerId === actorId,
    archived: isArchived(r.exchangeDate, now),
  }));
}

export interface RevealView {
  receiver: {
    name: string;
    image: string | null;
    bio: string | null;
  };
}

/**
 * The signed-in Santa's own Assignment: the only query that reads the
 * assignment table, always filtered by the actor (ADR 0002).
 * Marks the Reveal the first time it is opened.
 */
export async function revealMyAssignment(
  db: AppDb,
  actorId: string,
  groupId: string,
  opts: Options = {},
): Promise<RevealView | null> {
  const now = opts.now ?? new Date();
  const [g] = await db.select().from(group).where(eq(group.id, groupId));
  if (!g || !(await isMember(db, groupId, actorId))) {
    throw new DomainError("not-found", "Group not found.");
  }
  if (g.status !== "drawn") return null;

  const [mine] = await db
    .select({ receiverId: assignment.receiverId })
    .from(assignment)
    .where(and(eq(assignment.groupId, groupId), eq(assignment.santaId, actorId)));
  if (!mine) return null;

  const [r] = await db
    .select({
      name: user.name,
      image: user.image,
      bio: user.bio,
      pictureOverrideUrl: groupMember.pictureOverrideUrl,
      bioHidden: groupMember.bioHidden,
    })
    .from(user)
    .innerJoin(
      groupMember,
      and(eq(groupMember.userId, user.id), eq(groupMember.groupId, groupId)),
    )
    .where(eq(user.id, mine.receiverId));

  await db
    .update(groupMember)
    .set({ revealedAt: now })
    .where(
      and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, actorId),
        // Only the first open counts as the Reveal.
        isNull(groupMember.revealedAt),
      ),
    );

  return {
    receiver: {
      name: r.name,
      image: r.pictureOverrideUrl ?? r.image,
      bio: r.bioHidden ? null : r.bio,
    },
  };
}

/** Whether the actor has an Assignment waiting, without revealing it. */
export async function myRevealState(
  db: AppDb,
  actorId: string,
  groupId: string,
): Promise<{ hasAssignment: boolean; revealed: boolean }> {
  const [mine] = await db
    .select({ santaId: assignment.santaId })
    .from(assignment)
    .where(and(eq(assignment.groupId, groupId), eq(assignment.santaId, actorId)));
  const [me] = await db
    .select({ revealedAt: groupMember.revealedAt })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, actorId)));
  return { hasAssignment: Boolean(mine), revealed: Boolean(me?.revealedAt) };
}

/**
 * Permission check for an Organizer resetting a Member's password (there is
 * no email recovery, ADR 0004). Only Members of the Organizer's own Group,
 * and never themselves (they use their own account settings).
 */
export async function requireCanResetPassword(
  db: AppDb,
  actorId: string,
  groupId: string,
  memberId: string,
): Promise<void> {
  const [g] = await db.select().from(group).where(eq(group.id, groupId));
  if (!g) throw new DomainError("not-found", "Group not found.");
  requireOrganizer(g, actorId);
  if (memberId === actorId) {
    throw new DomainError("invalid", "You can't reset your own password here.");
  }
  if (!(await isMember(db, groupId, memberId))) {
    throw new DomainError("not-found", "That person isn't in this Group.");
  }
}

/** What an invite link shows before joining. Requires the code itself. */
export async function previewByCode(
  db: AppDb,
  code: string,
  opts: Options = {},
): Promise<{ groupId: string; name: string; joinable: boolean; memberCount: number } | null> {
  const now = opts.now ?? new Date();
  const [g] = await db
    .select()
    .from(group)
    .where(eq(group.inviteCode, code.trim().toUpperCase()));
  if (!g) return null;
  const [{ n }] = await db
    .select({ n: count() })
    .from(groupMember)
    .where(eq(groupMember.groupId, g.id));
  return {
    groupId: g.id,
    name: g.name,
    joinable: g.status === "open" && !isArchived(g.exchangeDate, now) && n < MAX_MEMBERS,
    memberCount: n,
  };
}

// ---------------------------------------------------------------------------
// Organizer Overrides
// ---------------------------------------------------------------------------

export async function setOverride(
  db: AppDb,
  actorId: string,
  groupId: string,
  memberId: string,
  change: { pictureOverrideUrl?: string | null; bioHidden?: boolean },
): Promise<{ previousPictureOverrideUrl: string | null }> {
  return db.transaction(async (tx) => {
    const g = await lockGroup(tx, groupId);
    requireOrganizer(g, actorId);
    const [m] = await tx
      .select({ pictureOverrideUrl: groupMember.pictureOverrideUrl })
      .from(groupMember)
      .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, memberId)));
    if (!m) throw new DomainError("not-found", "That person isn't in this Group.");
    await tx
      .update(groupMember)
      .set(change)
      .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, memberId)));
    return { previousPictureOverrideUrl: m.pictureOverrideUrl };
  });
}
