// Puts an email on the allowed list, or changes its role. Use it once to
// add the first admin; after that, admins manage access in the app.
//
//   pnpm access:allow --email baba@embersnacks.co.uk --role admin

import { parseArgs } from "node:util";
import postgres from "postgres";
import { z } from "zod";
import { emailSchema, ROLES } from "../entities/roles";
import { databaseUrl } from "../lib/env";

const argsSchema = z.object({
	email: emailSchema,
	role: z.enum(ROLES, { error: `must be one of ${ROLES.join(", ")}.` }).default("operator"),
});

const main = async () => {
	const { values } = parseArgs({ options: { email: { type: "string" }, role: { type: "string" } } });
	const args = argsSchema.safeParse(values);
	if (!args.success) {
		const [issue] = args.error.issues;
		throw new Error(`--${String(issue.path[0])}: ${issue.message}`);
	}
	const { email, role } = args.data;

	const sql = postgres(databaseUrl(), { prepare: false });
	try {
		await sql`
			insert into public.allowed_emails (email, role) values (${email}, ${role})
			on conflict (email) do update set role = excluded.role`;
		console.log(`${email} can now sign up and sign in as ${role}.`);
	} finally {
		await sql.end();
	}
};

main().catch((error: Error) => {
	console.error(error.message);
	process.exit(1);
});
