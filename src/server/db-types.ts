import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "@/db/schema";

/**
 * Any Drizzle Postgres database with our schema: Neon in the app,
 * PGlite in tests. Services take this so they never import a live client.
 */
export type AppDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type Tx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
