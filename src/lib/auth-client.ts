import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [usernameClient()] });

/**
 * Better Auth requires an email column; accounts here have none (ADR 0004).
 * This deterministic placeholder uses the reserved `.invalid` TLD, so it can
 * never belong to anyone or be delivered to.
 */
export const placeholderEmail = (username: string) =>
  `${username.trim().toLowerCase()}@users.sahara-santa.invalid`;
