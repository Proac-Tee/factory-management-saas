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

const siteUrlSchema = z.url({ error: "SITE_URL must be the app's address, like https://labels.embersnacks.co.uk." });

/**
 * The app's own address, for links in emails. Set SITE_URL in production:
 * the request's Origin header is only a fallback for local development,
 * because a request can claim any origin.
 */
export const siteOrigin = (requestOrigin: string | null, value = process.env.SITE_URL): string => {
	if (value) return new URL(siteUrlSchema.parse(value)).origin;
	if (requestOrigin) return requestOrigin;
	throw new Error("SITE_URL is not set (see .env.example).");
};
