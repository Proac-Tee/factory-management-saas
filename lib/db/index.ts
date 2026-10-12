import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseUrl } from "../env";
import * as schema from "./schema";

// Reuse one pool across dev hot reloads instead of leaking connections.
const globalForDb = globalThis as unknown as {
	pgClient?: ReturnType<typeof postgres>;
};

const client =
	globalForDb.pgClient ??
	postgres(databaseUrl(), {
		// Supabase's transaction pooler (port 6543) doesn't support prepared statements.
		prepare: false,
	});

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

// Connects as the `postgres` role, which BYPASSES row level security.
// Only use it directly for trusted server-side work; for user-facing
// queries use withRls() from ./rls.
export const db = drizzle({ client, schema });
