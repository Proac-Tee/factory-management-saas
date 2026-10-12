import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

// Create a new client per request; never share one across requests.
export const createClient = async () => {
	// Supabase reads the clock (session expiry), which Next can't prerender.
	await connection();
	const cookieStore = await cookies();

	return createServerClient(supabaseUrl, supabasePublishableKey, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				try {
					cookiesToSet.forEach(({ name, value, options }) =>
						cookieStore.set(name, value, options),
					);
				} catch {
					// The `setAll` method was called from a Server Component.
					// This can be ignored because `proxy.ts` refreshes user sessions.
				}
			},
		},
	});
};
