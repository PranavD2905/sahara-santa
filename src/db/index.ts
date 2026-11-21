import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Pooled (WebSocket) driver rather than neon-http, because the Draw and
// Patch need real transactions. The pool connects lazily on first query,
// so a missing DATABASE_URL fails at request time, not during `next build`.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ client: pool, schema });
export type Db = typeof db;
export { schema };
