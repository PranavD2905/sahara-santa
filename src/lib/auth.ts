import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { isDomainError } from "@/server/errors";
import { departAllGroups } from "@/server/groups";
import { pathFromUrl } from "@/server/picture-paths";
import { deletePicture } from "@/server/pictures";

/**
 * Username + password only, no email (ADR 0004). Better Auth still requires
 * an `email` column, so sign-up stores an internal placeholder built by
 * `placeholderEmail()`; it is never shown and never mailed.
 *
 * BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment by
 * Better Auth itself, so importing this module never needs secrets at build.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  user: {
    deleteUser: {
      enabled: true,
      // Leave every Group first so each Draw loop is Patched (ADR 0001).
      beforeDelete: async (u) => {
        try {
          await departAllGroups(db, u.id);
        } catch (e) {
          if (isDomainError(e)) throw new APIError("BAD_REQUEST", { message: e.message });
          throw e;
        }
      },
      afterDelete: async (u) => {
        await deletePicture(pathFromUrl(u.image));
      },
    },
    // Profile fields are written by app server actions, never by sign-up.
    additionalFields: {
      bio: { type: "string", required: false, input: false },
      songTrackId: { type: "string", required: false, input: false },
      songTitle: { type: "string", required: false, input: false },
      songArtist: { type: "string", required: false, input: false },
      songArtworkUrl: { type: "string", required: false, input: false },
      songExplicit: { type: "boolean", required: false, input: false },
    },
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/username": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },

  // Must be last: lets server actions set auth cookies.
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 }), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/** The current session in a Server Component / action, or null. */
export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Sets a new password for `userId` and signs them out everywhere. Callers
 * must check permission first (an Organizer resetting a Member of their
 * Group: see `requireCanResetPassword`).
 */
export async function setPasswordFor(userId: string, newPassword: string): Promise<void> {
  const ctx = await auth.$context;
  if (newPassword.length < 8 || newPassword.length > 128) {
    throw new Error("Password must be 8–128 characters.");
  }
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(newPassword));
  await db.delete(schema.session).where(eq(schema.session.userId, userId));
}
