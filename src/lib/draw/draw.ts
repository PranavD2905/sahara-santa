import { randomInt } from "node:crypto";
import {
  MIN_MEMBERS_TO_DRAW,
  type Assignment,
  type DrawResult,
  type Exclusion,
  type MemberId,
  type RandomInt,
} from "./types";

/** Cap on DFS steps before giving up; far above what real Groups (<=50) need. */
const SEARCH_STEP_BUDGET = 500_000;

const cryptoRandomInt: RandomInt = (max) => randomInt(max);

function shuffle<T>(items: readonly T[], rand: RandomInt): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Builds the symmetric "may not be adjacent" lookup, ignoring unknown ids. */
export function buildExclusionSet(
  members: readonly MemberId[],
  exclusions: readonly Exclusion[],
): Set<string> {
  const known = new Set(members);
  const set = new Set<string>();
  for (const [a, b] of exclusions) {
    if (a === b || !known.has(a) || !known.has(b)) continue;
    set.add(pairKey(a, b));
    set.add(pairKey(b, a));
  }
  return set;
}

export function pairKey(a: MemberId, b: MemberId): string {
  return `${a}\u0000${b}`;
}

/**
 * Draws one loop through all Members (A→B→C→…→A) so that nobody draws
 * themselves and no Exclusion is violated (ADR 0001).
 */
export function draw(
  members: readonly MemberId[],
  exclusions: readonly Exclusion[] = [],
  rand: RandomInt = cryptoRandomInt,
): DrawResult {
  if (new Set(members).size !== members.length) {
    return { ok: false, error: { kind: "duplicate-members" } };
  }
  if (members.length < MIN_MEMBERS_TO_DRAW) {
    return {
      ok: false,
      error: {
        kind: "too-few-members",
        have: members.length,
        need: MIN_MEMBERS_TO_DRAW,
      },
    };
  }

  const excluded = buildExclusionSet(members, exclusions);

  // Every Member sits in a loop, so needs two distinct neighbours.
  for (const id of members) {
    const allowed = members.filter(
      (other) => other !== id && !excluded.has(pairKey(id, other)),
    ).length;
    if (allowed < 2) {
      return { ok: false, error: { kind: "member-over-excluded", memberId: id } };
    }
  }

  const order = shuffle(members, rand);
  const start = order[0];
  const path: MemberId[] = [start];
  const used = new Set<MemberId>([start]);
  let steps = 0;
  let budgetHit = false;

  const extend = (): boolean => {
    if (path.length === order.length) {
      return !excluded.has(pairKey(path[path.length - 1], start));
    }
    const last = path[path.length - 1];
    for (const next of shuffle(order, rand)) {
      if (used.has(next) || excluded.has(pairKey(last, next))) continue;
      if (++steps > SEARCH_STEP_BUDGET) {
        budgetHit = true;
        return false;
      }
      path.push(next);
      used.add(next);
      if (extend()) return true;
      path.pop();
      used.delete(next);
      if (budgetHit) return false;
    }
    return false;
  };

  if (!extend()) {
    return { ok: false, error: { kind: "no-valid-loop", proven: !budgetHit } };
  }

  const assignments: Assignment[] = path.map((santaId, i) => ({
    santaId,
    receiverId: path[(i + 1) % path.length],
  }));
  return { ok: true, assignments };
}
