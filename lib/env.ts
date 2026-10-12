// Server-only settings, checked once when first used.

import { z } from "zod";

export const databaseUrlSchema = z
	.string({ error: "DATABASE_URL is not set (see .env.example)." })
	.regex(/^postgres(ql)?:\/\//, { error: "DATABASE_URL must be a postgres:// connection string (see .env.example)." });

/** The Postgres connection string, or a clear error saying what to set. */
export const databaseUrl = (value = process.env.DATABASE_URL): string => {
	const parsed = databaseUrlSchema.safeParse(value);
	if (!parsed.success) throw new Error(parsed.error.issues[0].message);
	return parsed.data;
};
