// Applies the migrations in drizzle/. Used instead of `drizzle-kit migrate`,
// which hides the database's error when a migration fails.
//
//   pnpm db:migrate
//
// Reads DATABASE_URL like the other scripts: .env.development.local wins
// over .env.local, and a DATABASE_URL already set in the shell wins over both.

import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { databaseUrl } from "../lib/env";

const MIGRATIONS = "drizzle";

/** user@host:port/db, never the password. */
const describe = (url: string) => {
	const u = new URL(url);
	return `${u.username || "?"}@${u.hostname}:${u.port || 5432}${u.pathname}`;
};

type PgError = Error & { code?: string; detail?: string; hint?: string; where?: string; cause?: unknown; query?: string };

const report = (error: unknown) => {
	// Drizzle wraps the Postgres error; the useful part is in `cause`.
	const outer = error as PgError;
	const pg = (outer.cause as PgError | undefined) ?? outer;
	console.error(`\nMigration failed: ${pg.message}`);
	if (pg.code) console.error(`  code:   ${pg.code}`);
	if (pg.detail) console.error(`  detail: ${pg.detail}`);
	if (pg.hint) console.error(`  hint:   ${pg.hint}`);
	if (pg.where) console.error(`  where:  ${pg.where}`);
	const unreachable = ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH"].includes(pg.code ?? "");
	if (outer.query && !unreachable) console.error(`  statement:\n${outer.query.trim().split("\n").slice(0, 12).map((l) => `    ${l}`).join("\n")}`);
	if (unreachable) {
		console.error(
			"\nCouldn't reach the database. For Supabase cloud use the transaction pooler URL (port 6543);" +
				"\nthe direct db.<ref>.supabase.co host is IPv6-only. For local Supabase, run `supabase start`.",
		);
	}
};

const main = async () => {
	const url = databaseUrl();
	const journal = JSON.parse(readFileSync(`${MIGRATIONS}/meta/_journal.json`, "utf8")) as { entries: { tag: string }[] };
	console.log(`Database: ${describe(url)}`);
	console.log(`Migrations in ${MIGRATIONS}/: ${journal.entries.length} (latest ${journal.entries.at(-1)?.tag})`);

	const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
	try {
		await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS });
		const [{ count }] = await client`select count(*)::int as count from drizzle.__drizzle_migrations`;
		console.log(`Up to date: ${count} of ${journal.entries.length} applied.`);
	} catch (error) {
		report(error);
		process.exitCode = 1;
	} finally {
		await client.end();
	}
};

main().catch((error) => {
	console.error((error as Error).message);
	process.exit(1);
});
