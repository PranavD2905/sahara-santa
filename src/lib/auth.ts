import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";

// BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment by
// Better Auth itself, so importing this module never needs secrets at build.
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
    requireEmailVerification: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Sahara Santa password",
        text: `Hi ${user.name},\n\nReset your password here:\n${url}\n\nIf you didn't ask for this, ignore this email.`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your Sahara Santa email",
        text: `Hi ${user.name},\n\nConfirm your email to join Secret Santa groups:\n${url}`,
      });
    },
  },

  user: {
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
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },

  // Must be last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/** The current session in a Server Component / action, or null. */
export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}
