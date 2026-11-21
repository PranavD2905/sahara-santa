import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { AppDb } from "./db-types";

/** A fresh in-process Postgres with the real migrations applied. */
export async function createTestDb(): Promise<AppDb> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as AppDb;
}

let counter = 0;

export async function createUser(
  db: AppDb,
  overrides: Partial<typeof schema.user.$inferInsert> = {},
): Promise<string> {
  const id = overrides.id ?? `u${++counter}`;
  await db.insert(schema.user).values({
    id,
    name: overrides.name ?? `User ${id}`,
    email: overrides.email ?? `${id}@example.test`,
    emailVerified: overrides.emailVerified ?? true,
    ...overrides,
  });
  return id;
}
