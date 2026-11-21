export type MemberId = string;

/** One Assignment: `santaId` gives a gift to `receiverId`. */
export interface Assignment {
  santaId: MemberId;
  receiverId: MemberId;
}

/**
 * An Exclusion is symmetric: the pair can be neither each other's Santa
 * nor each other's receiver.
 */
export type Exclusion = readonly [MemberId, MemberId];

/** Returns a uniform integer in [0, maxExclusive). */
export type RandomInt = (maxExclusive: number) => number;

export const MIN_MEMBERS_TO_DRAW = 3;

export type DrawError =
  | { kind: "too-few-members"; have: number; need: number }
  | { kind: "duplicate-members" }
  | { kind: "member-over-excluded"; memberId: MemberId }
  | {
      kind: "no-valid-loop";
      /** true: exhaustive search proved none exists; false: search gave up. */
      proven: boolean;
    };

export type DrawResult =
  | { ok: true; assignments: Assignment[] }
  | { ok: false; error: DrawError };

export type PatchResult =
  /** The loop was closed; `changedSantaId` now has a new receiver. */
  | {
      kind: "patched";
      assignments: Assignment[];
      changedSantaId: MemberId;
    }
  /** Fewer than 2 Members remain: every Assignment is cleared. */
  | { kind: "cleared" }
  /** The gap would break an Exclusion; the Organizer must Re-draw. */
  | { kind: "needs-redraw" }
  | { kind: "not-a-member" };
