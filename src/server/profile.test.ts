import { beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "./db-types";
import { createGroup, joinByCode } from "./groups";
import { canViewPicture, parsePicturePath, pathFromUrl } from "./picture-paths";
import { getProfile, requireProfilePicture, setPicture, updateProfile } from "./profile";
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
  it("requires a saved picture for profile completion", async () => {
    const u = await createUser(db);
    await expect(requireProfilePicture(db, u)).rejects.toMatchObject({ code: "invalid" });
    await setPicture(db, u, `/api/pictures/profiles/${u}/avatar.webp`);
    await expect(requireProfilePicture(db, u)).resolves.toBeUndefined();
  });

  it("validates name and bio, and collapses bio whitespace", async () => {
    const u = await createUser(db);
    await updateProfile(db, u, { name: "  Asha  ", bio: "Loves\n\n  tea" });
    expect(await getProfile(db, u)).toMatchObject({ name: "Asha", bio: "Loves tea" });
    await expect(updateProfile(db, u, { name: "", bio: "" })).rejects.toMatchObject({ code: "invalid" });
    await expect(updateProfile(db, u, { name: "A", bio: "x".repeat(151) })).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("rejects empty and whitespace-only bios without changing the saved profile", async () => {
    const u = await createUser(db);
    await updateProfile(db, u, { name: "Asha", bio: "Loves tea" });
    for (const bio of ["", "   ", "\n\t", "\u00a0"]) {
      await expect(updateProfile(db, u, { name: "Changed", bio })).rejects.toMatchObject({
        code: "invalid",
        message: "Add a bio to complete your profile.",
      });
    }
    expect(await getProfile(db, u)).toMatchObject({ name: "Asha", bio: "Loves tea" });
  });

});
