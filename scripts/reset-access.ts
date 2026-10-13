// Removes every account and allowed-list entry except one admin's, to start
// sign-ups again. Labels, products, folders and pictures stay (who made them
// is cleared); label checks done by the removed people go with them.
//
//   pnpm access:reset --keep you@embersnacks.co.uk         (shows who, deletes nothing)
//   pnpm access:reset --keep you@embersnacks.co.uk --yes   (deletes)
//
// Runs as the database owner (DATABASE_URL), so it's for an admin on their
// own machine. There is no undo.

import { parseArgs } from "node:util";
import postgres from "postgres";
import { z } from "zod";
import { emailSchema } from "../entities/roles";
import { databaseUrl } from "../lib/env";

const main = async () => {
	const { values } = parseArgs({ options: { keep: { type: "string" }, yes: { type: "boolean" } } });
	const keep = emailSchema.safeParse(values.keep ?? "");
	if (!keep.success) throw new Error("Say whose account to keep: pnpm access:reset --keep you@embersnacks.co.uk");

	const url = databaseUrl();
	const { hostname, pathname } = new URL(url);
	const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
	try {
		console.log(`Database: ${hostname}${pathname}`);
		// Only an admin may be kept, so this can't leave the app with nobody to let people back in.
		const [kept] = await sql<{ role: string }[]>`select role from public.allowed_emails where email = ${keep.data}`;
		if (kept?.role !== "admin") {
			throw new Error(`${keep.data} isn't an admin on the allowed list, so nothing was deleted. Check the email.`);
		}

		const accounts = await sql<{ email: string | null; checks: number }[]>`
			select u.email, (select count(*)::int from public.label_checks c where c.checked_by = u.id) as checks
			from auth.users u
			where lower(coalesce(u.email, '')) <> ${keep.data}
			order by u.email`;
		const allowed = await sql<{ email: string; role: string }[]>`
			select email, role from public.allowed_emails where email <> ${keep.data} order by email`;
		const checks = accounts.reduce((n, a) => n + a.checks, 0);

		console.log(`Keeping ${keep.data} (admin).`);
		console.log(`\nWould delete ${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}:`);
		for (const a of accounts) console.log(`  ${a.email ?? "(no email)"}${a.checks ? `  (${a.checks} label checks)` : ""}`);
		console.log(`\nWould take ${allowed.length} ${allowed.length === 1 ? "email" : "emails"} off the allowed list:`);
		for (const a of allowed) console.log(`  ${a.email}  (${a.role})`);
		if (checks) console.log(`\n${checks} label checks done by these people go too.`);

		if (!values.yes) {
			console.log("\nNothing deleted. Run again with --yes to delete them.");
			return;
		}
		await sql.begin(async (tx) => {
			const gone = tx`select id from auth.users where lower(coalesce(email, '')) <> ${keep.data}`;
			await tx`delete from public.label_checks where checked_by in (${gone})`;
			// Profiles, sessions and sign-in identities go with the account.
			await tx`delete from auth.users where lower(coalesce(email, '')) <> ${keep.data}`;
			await tx`delete from public.allowed_emails where email <> ${keep.data}`;
		});
		console.log("\nDeleted. Add people again in the app (People and access), then they choose a password.");
	} finally {
		await sql.end();
	}
};

main().catch((error: Error) => {
	console.error(error.message);
	process.exit(1);
});
