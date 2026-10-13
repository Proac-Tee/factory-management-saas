import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Supabase with the secret key: can create accounts and set passwords, and
// skips every database rule. Server only, and only through data-access/
// accounts.ts, after the use-case has checked the person is an admin.
//
// The Supabase integration on Vercel sets SUPABASE_SERVICE_ROLE_KEY; a
// newer secret key (sb_secret_…) can be set as SUPABASE_SECRET_KEY instead.

export const createAdminClient = () => {
	const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) {
		throw new Error(
			"SUPABASE_SECRET_KEY is not set, so accounts can't be created. Add the secret (service role) key from Supabase → Project Settings → API Keys (see .env.example).",
		);
	}
	return createClient(supabaseUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });
};
