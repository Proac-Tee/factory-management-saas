import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./lib/env";

// Load .env.local the same way `next dev` does.
loadEnvConfig(process.cwd());

export default defineConfig({
	dialect: "postgresql",
	schema: "./lib/db/schema.ts",
	out: "./drizzle",
	dbCredentials: { url: databaseUrl() },
	// Only manage our own tables; auth, storage, etc. belong to Supabase.
	schemaFilter: ["public"],
	// Supabase roles (anon, authenticated, ...) already exist; don't create them.
	entities: { roles: { provider: "supabase" } },
	strict: true,
	verbose: true,
});
