// Deletes every label, product and label check, to start the import again.
// Accounts, the allowed list and the database structure are kept.
//
//   pnpm labels:reset         (shows what would be deleted, deletes nothing)
//   pnpm labels:reset --yes   (deletes)
//
// Runs as the database owner (DATABASE_URL), so it's for an admin on their
// own machine. There is no undo.

import { parseArgs } from "node:util";
import postgres from "postgres";
import { databaseUrl } from "../lib/env";

const main = async () => {
	const { values } = parseArgs({ options: { yes: { type: "boolean" } } });
	const url = databaseUrl();
	const { hostname, pathname } = new URL(url);
	const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
	try {
		const [counts] = await sql<{ labels: number; products: number; checks: number }[]>`
			select
				(select count(*)::int from public.labels) as labels,
				(select count(*)::int from public.products) as products,
				(select count(*)::int from public.label_checks) as checks`;
		console.log(`Database: ${hostname}${pathname}`);
		console.log(`Would delete ${counts.labels} labels, ${counts.products} products and ${counts.checks} label checks.`);
		if (!values.yes) {
			console.log("Nothing deleted. Run again with --yes to delete them.");
			return;
		}
		await sql.begin(async (tx) => {
			await tx`delete from public.label_checks`;
			await tx`delete from public.labels`;
			await tx`delete from public.products`;
		});
		console.log("Deleted. Accounts and the allowed list are untouched; import again with pnpm labels:import.");
	} finally {
		await sql.end();
	}
};

main().catch((error: Error) => {
	console.error(error.message);
	process.exit(1);
});
