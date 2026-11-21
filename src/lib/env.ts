import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  /** Optional in development: emails are logged to the console instead. */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Sahara Santa <onboarding@resend.dev>"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

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
