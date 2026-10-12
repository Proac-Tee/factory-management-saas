import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

export const updateSession = async (request: NextRequest) => {
	let supabaseResponse = NextResponse.next({ request });

	const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet, headers) {
				cookiesToSet.forEach(({ name, value }) =>
					request.cookies.set(name, value),
				);
				supabaseResponse = NextResponse.next({ request });
				cookiesToSet.forEach(({ name, value, options }) =>
					supabaseResponse.cookies.set(name, value, options),
				);
				// Stop CDNs from caching a response that carries a session cookie.
				Object.entries(headers).forEach(([key, value]) =>
					supabaseResponse.headers.set(key, value),
				);
			},
		},
	});

	// Do not run code between createServerClient and getClaims(): this call
	// validates the JWT and refreshes an expired session. Removing it can
	// randomly log users out.
	const { data } = await supabase.auth.getClaims();
	const user = data?.claims;

	// Gate protected routes here once auth pages exist, e.g.:
	// if (!user && !request.nextUrl.pathname.startsWith("/login")) {
	// 	const url = request.nextUrl.clone();
	// 	url.pathname = "/login";
	// 	return NextResponse.redirect(url);
	// }
	void user;

	// Return supabaseResponse as-is. If you build a different response, copy
	// its cookies over, or the browser and server sessions will drift apart.
	return supabaseResponse;
};
