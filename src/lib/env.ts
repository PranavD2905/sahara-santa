import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  /**
   * Public URL of the app. Set it in Production (your stable domain). Leave
   * it unset in Preview: each preview deployment then uses its own URL.
   */
  BETTER_AUTH_URL: z.string().url().optional(),
  /** Set automatically by Vercel on every deployment (host only, no scheme). */
  VERCEL_URL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Base URL for invite links: BETTER_AUTH_URL, else the
 * Vercel deployment URL (previews), else localhost.
 */
export function appUrl(): string {
  const e = env();
  if (e.BETTER_AUTH_URL) return e.BETTER_AUTH_URL.replace(/\/$/, "");
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Validated server env, read lazily so `next build` works without secrets. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid or missing environment variables: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
