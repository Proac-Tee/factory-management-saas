import "server-only";
import { sql } from "drizzle-orm";
import type { JwtPayload } from "@supabase/supabase-js";
import { db } from "./index";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Run queries as the signed-in user so Postgres RLS policies apply,
// the same way they do for requests through the Supabase Data API.
export const withRls = <T>(claims: JwtPayload, fn: (tx: Tx) => Promise<T>) =>
	db.transaction(async (tx) => {
		await tx.execute(sql`
			select
				set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
				set_config('request.jwt.claim.sub', ${claims.sub}, true)
		`);
		await tx.execute(sql`set local role authenticated`);
		return fn(tx);
	});
