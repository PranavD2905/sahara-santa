import "server-only";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import type { AppDb } from "@/server/db-types";
import * as schema from "./schema";

/**
 * Production: Neon via its pooled (WebSocket) driver rather than neon-http,
 * because the Draw and Patch need real transactions.
 *
 * Local development: a localhost URL uses plain node-postgres, so any local
 * Postgres works, including `npm run db:local` (PGlite as a Postgres
 * server, no install needed). Pools connect lazily, so a missing
 * DATABASE_URL fails at request time, not during `next build`.
 */
function createDb(): AppDb {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1)[:/]/.test(url);

  if (isLocal) {
    // PGlite's server handles one connection at a time; harmless elsewhere.
    const pool = new PgPool({ connectionString: url, max: 1 });
    return drizzlePg({ client: pool, schema }) as unknown as AppDb;
  }
  const pool = new NeonPool({ connectionString: url });
  return drizzleNeon({ client: pool, schema }) as unknown as AppDb;
}

export const db = createDb();
export { schema };
