import { buildExclusionSet, pairKey } from "./draw";
import type {
  Assignment,
  Exclusion,
  MemberId,
  PatchResult,
} from "./types";

/**
 * Closes the gap in the loop when `leaverId` leaves or is removed after the
 * Draw: the leaver's Santa takes over the leaver's receiver. Because the Draw
 * is a single loop (ADR 0001) this can never make anyone draw themselves; it
 * can only break an Exclusion, in which case the Organizer must Re-draw.
 */
export function patch(
  assignments: readonly Assignment[],
  leaverId: MemberId,
  exclusions: readonly Exclusion[] = [],
): PatchResult {
  const asReceiver = assignments.find((a) => a.receiverId === leaverId);
  const asSanta = assignments.find((a) => a.santaId === leaverId);
  if (!asReceiver || !asSanta) return { kind: "not-a-member" };

  const remaining = assignments.length - 1;
  if (remaining < 2) return { kind: "cleared" };

  const santaId = asReceiver.santaId;
  const receiverId = asSanta.receiverId;

  const everyone = assignments.map((a) => a.santaId);
  const excluded = buildExclusionSet(everyone, exclusions);
  if (excluded.has(pairKey(santaId, receiverId))) {
    return { kind: "needs-redraw" };
  }

  const next: Assignment[] = assignments
    .filter((a) => a.santaId !== leaverId && a.receiverId !== leaverId)
    .concat({ santaId, receiverId });

  return { kind: "patched", assignments: next, changedSantaId: santaId };
}
