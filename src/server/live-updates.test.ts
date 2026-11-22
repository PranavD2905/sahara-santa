import { beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "./db-types";
import { createGroup, joinByCode, updateSettings } from "./groups";
import { liveRevision } from "./live-updates";
import { updateProfile } from "./profile";
import { createTestDb, createUser } from "./test-db";

let db: AppDb;
beforeAll(async () => { db = await createTestDb(); });
const settings = { name: "Live Santa", currency: "INR" as const, budgetMin: null, budgetMax: null, exchangeDate: null };

describe("live revisions", () => {
  it("changes for membership, group settings, and member profile edits", async () => {
    const owner = await createUser(db);
    const member = await createUser(db);
    const { id, inviteCode } = await createGroup(db, owner, settings);
    const path = `/groups/${id}`;
    const initial = await liveRevision(db, owner, path);
    expect(await liveRevision(db, owner, path)).toBe(initial);
    await joinByCode(db, member, inviteCode);
    const joined = await liveRevision(db, owner, path);
    expect(joined).not.toBe(initial);
    await updateProfile(db, member, { name: "New name", bio: "Loves music" });
    const edited = await liveRevision(db, owner, path);
    expect(edited).not.toBe(joined);
    await updateSettings(db, owner, id, { ...settings, name: "Renamed" });
    expect(await liveRevision(db, owner, path)).not.toBe(edited);
  });

  it("updates the group list after creating or joining a group", async () => {
    const member = await createUser(db);
    const initial = await liveRevision(db, member, "/");
    await createGroup(db, member, settings);
    expect(await liveRevision(db, member, "/")).not.toBe(initial);
  });

  it("does not grant non-members access to group revisions", async () => {
    const owner = await createUser(db);
    const stranger = await createUser(db);
    const { id } = await createGroup(db, owner, settings);
    await expect(liveRevision(db, stranger, `/groups/${id}`)).rejects.toMatchObject({ code: "not-found" });
  });
});
