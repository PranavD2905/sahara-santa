import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, getProfile, organizerPicture } = vi.hoisted(() => ({ getSession: vi.fn(), getProfile: vi.fn(), organizerPicture: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getSession }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("./profile", () => ({ getProfile, organizerPicture }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));

import { requireUser } from "./session";

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "u1", bio: null } });
  getProfile.mockResolvedValue({ bio: "Loves tea", image: "/avatar.webp" });
  organizerPicture.mockResolvedValue(null);
});

describe("required profile", () => {
  it("accepts an organizer-provided picture for an existing group", async () => {
    getProfile.mockResolvedValue({ bio: "Loves tea", image: null });
    organizerPicture.mockResolvedValue("/group-picture.webp");
    await expect(requireUser("/groups/g1")).resolves.toMatchObject({ id: "u1" });
  });

  it("requires a profile picture even if a bio is already saved", async () => {
    getProfile.mockResolvedValue({ bio: "Loves tea", image: null });
    await expect(requireUser("/groups/new")).rejects.toThrow("redirect:/profile?next=%2Fgroups%2Fnew");
  });

  it("redirects signed-out users to sign-in with their destination", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser("/join/CODE")).rejects.toThrow("redirect:/sign-in?next=%2Fjoin%2FCODE");
    expect(getProfile).not.toHaveBeenCalled();
  });

  it.each([null, "", " \n\t"])("requires profile completion for a blank bio (%s)", async (bio) => {
    getProfile.mockResolvedValue({ bio });
    await expect(requireUser("/join/CODE")).rejects.toThrow("redirect:/profile?next=%2Fjoin%2FCODE");
  });

  it("lets users open their incomplete profile without a redirect loop", async () => {
    getProfile.mockResolvedValue({ bio: null });
    await expect(requireUser("/profile")).resolves.toMatchObject({ id: "u1" });
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("uses the saved bio even when the session still has a blank bio", async () => {
    await expect(requireUser("/groups/g1")).resolves.toMatchObject({ id: "u1" });
    expect(getProfile).toHaveBeenCalledWith({}, "u1");
  });
});
