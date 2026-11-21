import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { draw, patch, validateLoop } from "./index";
import type { Exclusion, MemberId } from "./types";

const ids = (n: number): MemberId[] =>
  Array.from({ length: n }, (_, i) => `m${i}`);

/** A seeded LCG so example tests are deterministic. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return (max: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % max;
  };
}

/** Random Group (3-12) with random symmetric exclusions between its members. */
const groupArb = fc
  .integer({ min: 3, max: 12 })
  .chain((n) => {
    const members = ids(n);
    const pairs = fc.array(
      fc.tuple(fc.integer({ min: 0, max: n - 1 }), fc.integer({ min: 0, max: n - 1 })),
      { maxLength: n },
    );
    return fc.tuple(fc.constant(members), pairs, fc.integer());
  })
  .map(([members, pairs, seed]) => ({
    members,
    exclusions: pairs.map(([a, b]) => [members[a], members[b]] as Exclusion),
    seed,
  }));

describe("draw", () => {
  it("rejects fewer than 3 Members", () => {
    const r = draw(ids(2));
    expect(r).toEqual({
      ok: false,
      error: { kind: "too-few-members", have: 2, need: 3 },
    });
  });

  it("rejects duplicate member ids", () => {
    expect(draw(["a", "b", "a"]).ok).toBe(false);
  });

  it("draws a valid single loop for 3 Members (the only possible shapes)", () => {
    const r = draw(ids(3), [], seeded(1));
    expect(r.ok).toBe(true);
    if (r.ok) expect(validateLoop(ids(3), r.assignments)).toEqual([]);
  });

  it("names the Member who is excluded from everyone", () => {
    // m0 can only pair with m1: needs two neighbours for a loop.
    const r = draw(ids(4), [["m0", "m2"], ["m0", "m3"]]);
    expect(r).toEqual({
      ok: false,
      error: { kind: "member-over-excluded", memberId: "m0" },
    });
  });

  it("proves impossibility when Exclusions leave no loop", () => {
    // Two cliques {m0,m1,m2} and {m3,m4,m5} with all cross pairs excluded:
    // every Member has 2 neighbours, but no loop spans both groups.
    const cross: Exclusion[] = [];
    for (const a of ["m0", "m1", "m2"]) {
      for (const b of ["m3", "m4", "m5"]) cross.push([a, b]);
    }
    const r = draw(ids(6), cross, seeded(7));
    expect(r).toEqual({ ok: false, error: { kind: "no-valid-loop", proven: true } });
  });

  it("is a valid loop for 50 Members with many Exclusions", () => {
    const members = ids(50);
    const exclusions: Exclusion[] = [];
    for (let i = 0; i < 50; i += 2) exclusions.push([members[i], members[i + 1]]);
    const r = draw(members, exclusions);
    expect(r.ok).toBe(true);
    if (r.ok) expect(validateLoop(members, r.assignments, exclusions)).toEqual([]);
  });

  it("ignores Exclusions that mention unknown or identical ids", () => {
    const r = draw(ids(3), [["ghost", "m0"], ["m1", "m1"]], seeded(3));
    expect(r.ok).toBe(true);
  });

  it("produces different loops across seeds (not a fixed ordering)", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const r = draw(ids(6), [], seeded(seed));
      if (r.ok) seen.add(r.assignments.map((a) => a.receiverId).join());
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it("property: any Draw that succeeds is a valid loop respecting Exclusions", () => {
    fc.assert(
      fc.property(groupArb, ({ members, exclusions, seed }) => {
        const r = draw(members, exclusions, seeded(seed));
        if (r.ok) {
          expect(validateLoop(members, r.assignments, exclusions)).toEqual([]);
        } else {
          expect(["member-over-excluded", "no-valid-loop"]).toContain(r.error.kind);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("property: with no Exclusions a Draw always succeeds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 50 }), fc.integer(), (n, seed) => {
        const members = ids(n);
        const r = draw(members, [], seeded(seed));
        expect(r.ok).toBe(true);
        if (r.ok) expect(validateLoop(members, r.assignments)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});

describe("patch", () => {
  const loop = (members: MemberId[]) => {
    const r = draw(members, [], seeded(11));
    if (!r.ok) throw new Error("setup draw failed");
    return r.assignments;
  };

  it("hands the leaver's receiver to the leaver's Santa", () => {
    const members = ids(5);
    const a = loop(members);
    const leaver = "m2";
    const santa = a.find((x) => x.receiverId === leaver)!.santaId;
    const receiver = a.find((x) => x.santaId === leaver)!.receiverId;

    const r = patch(a, leaver);
    expect(r.kind).toBe("patched");
    if (r.kind === "patched") {
      expect(r.changedSantaId).toBe(santa);
      expect(r.assignments.find((x) => x.santaId === santa)!.receiverId).toBe(receiver);
      const rest = members.filter((m) => m !== leaver);
      expect(validateLoop(rest, r.assignments)).toEqual([]);
    }
  });

  it("never makes anyone draw themselves, even where a swap would have", () => {
    // A 4-person loop where one leaves leaves a valid 3-loop.
    const members = ids(4);
    const a = loop(members);
    for (const leaver of members) {
      const r = patch(a, leaver);
      expect(r.kind).toBe("patched");
      if (r.kind === "patched") {
        expect(r.assignments.every((x) => x.santaId !== x.receiverId)).toBe(true);
      }
    }
  });

  it("works down to 2 Members, then clears at 1", () => {
    let a = loop(ids(3));
    const first = patch(a, "m0");
    expect(first.kind).toBe("patched");
    if (first.kind !== "patched") return;
    a = first.assignments;
    expect(validateLoop(["m1", "m2"], a)).toEqual([]);
    expect(patch(a, "m1")).toEqual({ kind: "cleared" });
  });

  it("asks for a Re-draw when the patch would break an Exclusion", () => {
    const members = ids(5);
    const a = loop(members);
    const leaver = "m1";
    const santa = a.find((x) => x.receiverId === leaver)!.santaId;
    const receiver = a.find((x) => x.santaId === leaver)!.receiverId;
    expect(patch(a, leaver, [[santa, receiver]])).toEqual({ kind: "needs-redraw" });
  });

  it("reports a non-member", () => {
    expect(patch(loop(ids(3)), "nobody")).toEqual({ kind: "not-a-member" });
  });

  it("property: repeated patches keep a valid loop until the Group is too small", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        fc.integer(),
        fc.array(fc.nat(), { minLength: 1, maxLength: 17 }),
        (n, seed, picks) => {
          let members = ids(n);
          const first = draw(members, [], seeded(seed));
          if (!first.ok) throw new Error("setup draw failed");
          let a = first.assignments;
          for (const pick of picks) {
            if (members.length < 3) break;
            const leaver = members[pick % members.length];
            const r = patch(a, leaver);
            expect(r.kind).toBe("patched");
            if (r.kind !== "patched") return;
            members = members.filter((m) => m !== leaver);
            a = r.assignments;
            expect(validateLoop(members, a)).toEqual([]);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
