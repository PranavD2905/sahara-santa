import { beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "./db-types";
import { createGroup, joinByCode } from "./groups";
import { canViewPicture, parsePicturePath, pathFromUrl } from "./picture-paths";
import { getProfile, setSong, updateProfile } from "./profile";
import { createTestDb, createUser } from "./test-db";

let db: AppDb;
beforeEach(async () => {
  db = await createTestDb();
});

describe("picture paths", () => {
  it("accepts only the two known shapes", () => {
    expect(parsePicturePath("profiles/u1/abc.webp")).toMatchObject({ kind: "profile", ownerId: "u1" });
    expect(parsePicturePath("overrides/g1/u1/abc.webp")).toMatchObject({ kind: "override", groupId: "g1" });
    for (const bad of [
      "profiles/../u1/abc.webp",
      "profiles/u1/abc.png",
      "/profiles/u1/abc.webp",
      "profiles/u1/sub/abc.webp",
      "other/u1/abc.webp",
    ]) {
      expect(parsePicturePath(bad)).toBeNull();
    }
    expect(pathFromUrl("/api/pictures/profiles/u1/a.webp")).toBe("profiles/u1/a.webp");
    expect(pathFromUrl("https://evil.test/x")).toBeNull();
  });

  it("shows a Profile Picture only to the owner and people sharing a Group", async () => {
    const owner = await createUser(db);
    const friend = await createUser(db);
    const stranger = await createUser(db);
    const { inviteCode } = await createGroup(db, owner, {
      name: "G",
      currency: "INR",
      budgetMin: null,
      budgetMax: null,
      exchangeDate: null,
    });
    await joinByCode(db, friend, inviteCode);
    const path = `profiles/${owner}/x.webp`;
    expect(await canViewPicture(db, owner, path)).toBe(true);
    expect(await canViewPicture(db, friend, path)).toBe(true);
    expect(await canViewPicture(db, stranger, path)).toBe(false);
  });

  it("shows an Override only inside its Group", async () => {
    const owner = await createUser(db);
    const stranger = await createUser(db);
    const { id } = await createGroup(db, owner, {
      name: "G",
      currency: "INR",
      budgetMin: null,
      budgetMax: null,
      exchangeDate: null,
    });
    const path = `overrides/${id}/${owner}/x.webp`;
    expect(await canViewPicture(db, owner, path)).toBe(true);
    expect(await canViewPicture(db, stranger, path)).toBe(false);
  });
});

describe("profile", () => {
  it("validates name and bio, and collapses bio whitespace", async () => {
    const u = await createUser(db);
    await updateProfile(db, u, { name: "  Asha  ", bio: "Loves\n\n  tea" });
    expect(await getProfile(db, u)).toMatchObject({ name: "Asha", bio: "Loves tea" });
    await expect(updateProfile(db, u, { name: "", bio: "" })).rejects.toMatchObject({ code: "invalid" });
    await expect(updateProfile(db, u, { name: "A", bio: "x".repeat(151) })).rejects.toMatchObject({
      code: "invalid",
    });
    await updateProfile(db, u, { name: "A", bio: "   " });
    expect((await getProfile(db, u)).bio).toBeNull();
  });

  it("sets and clears the Song", async () => {
    const u = await createUser(db);
    await setSong(db, u, { trackId: "1", title: "T", artist: "A", artworkUrl: null, explicit: true });
    expect((await getProfile(db, u)).song).toMatchObject({ trackId: "1", explicit: true });
    await setSong(db, u, null);
    expect((await getProfile(db, u)).song).toBeNull();
  });
});
