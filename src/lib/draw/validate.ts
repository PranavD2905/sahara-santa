import { buildExclusionSet, pairKey } from "./draw";
import type { Assignment, Exclusion, MemberId } from "./types";

/**
 * Checks the Draw invariants: every Member is exactly once a Santa and once
 * a receiver, nobody draws themselves, no Exclusion is violated, and all
 * Members form one single loop. Returns a list of problems (empty = valid).
 */
export function validateLoop(
  members: readonly MemberId[],
  assignments: readonly Assignment[],
  exclusions: readonly Exclusion[] = [],
): string[] {
  const problems: string[] = [];
  const memberSet = new Set(members);
  const receiverOf = new Map<MemberId, MemberId>();
  const santaOf = new Map<MemberId, MemberId>();

  for (const { santaId, receiverId } of assignments) {
    if (!memberSet.has(santaId) || !memberSet.has(receiverId)) {
      problems.push(`unknown member in ${santaId}->${receiverId}`);
    }
    if (santaId === receiverId) problems.push(`${santaId} draws themselves`);
    if (receiverOf.has(santaId)) problems.push(`${santaId} is Santa twice`);
    if (santaOf.has(receiverId)) problems.push(`${receiverId} has two Santas`);
    receiverOf.set(santaId, receiverId);
    santaOf.set(receiverId, santaId);
  }

  for (const id of members) {
    if (!receiverOf.has(id)) problems.push(`${id} has no receiver`);
    if (!santaOf.has(id)) problems.push(`${id} has no Santa`);
  }

  const excluded = buildExclusionSet(members, exclusions);
  for (const { santaId, receiverId } of assignments) {
    if (excluded.has(pairKey(santaId, receiverId))) {
      problems.push(`excluded pair ${santaId}->${receiverId}`);
    }
  }

  if (problems.length === 0 && members.length > 0) {
    let length = 0;
    let cursor = members[0];
    do {
      cursor = receiverOf.get(cursor) as MemberId;
      length++;
    } while (cursor !== members[0] && length <= members.length);
    if (length !== members.length) problems.push("not a single loop");
  }

  return problems;
}
