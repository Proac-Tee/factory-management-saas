import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load .env.local the same way `next dev` does.
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
	throw new Error("Missing env var DATABASE_URL (see .env.example).");
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./lib/db/schema.ts",
	out: "./drizzle",
	dbCredentials: { url: process.env.DATABASE_URL },
	// Only manage our own tables; auth, storage, etc. belong to Supabase.
	schemaFilter: ["public"],
	// Supabase roles (anon, authenticated, ...) already exist; don't create them.
	entities: { roles: { provider: "supabase" } },
	strict: true,
	verbose: true,
});
