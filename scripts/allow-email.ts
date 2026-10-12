// Puts an email on the allowed list, or changes its role. Use it once to
// add the first admin; after that, admins manage access in the app.
//
//   pnpm access:allow --email baba@embersnacks.co.uk --role admin

import { parseArgs } from "node:util";
import postgres from "postgres";
import { checkEmail, isRole, ROLES } from "../entities/roles";

const main = async () => {
	const { values } = parseArgs({ options: { email: { type: "string" }, role: { type: "string" } } });
	const email = checkEmail(values.email ?? "");
	if (!email.ok) throw new Error(`--email: ${email.message}`);
	const role = values.role ?? "operator";
	if (!isRole(role)) throw new Error(`--role must be one of ${ROLES.join(", ")}.`);
	if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example).");

	const sql = postgres(process.env.DATABASE_URL, { prepare: false });
	try {
		await sql`
			insert into public.allowed_emails (email, role) values (${email.email}, ${role})
			on conflict (email) do update set role = excluded.role`;
		console.log(`${email.email} can now sign up and sign in as ${role}.`);
	} finally {
		await sql.end();
	}
};

main().catch((error: Error) => {
	console.error(error.message);
	process.exit(1);
});
