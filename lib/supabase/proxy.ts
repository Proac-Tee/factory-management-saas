import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

const PROTECTED_PREFIXES = ["/labels", "/scan", "/access", "/reset-password"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

// Carry refreshed session cookies and cache headers onto a redirect.
const redirectWithCookies = (url: URL, from: NextResponse) => {
	const response = NextResponse.redirect(url);
	from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
	from.headers.forEach((value, key) => {
		if (key !== "set-cookie" && !key.startsWith("x-middleware-"))
			response.headers.set(key, value);
	});
	return response;
};

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
	const isSignedIn = Boolean(data?.claims);

	// Optimistic redirects only; pages still verify via lib/auth.ts.
	const { pathname } = request.nextUrl;
	const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
	const isAuthPage = AUTH_PAGES.includes(pathname);
	if ((!isSignedIn && isProtected) || (isSignedIn && isAuthPage)) {
		const url = request.nextUrl.clone();
		url.pathname = isSignedIn ? "/labels" : "/login";
		url.search = "";
		return redirectWithCookies(url, supabaseResponse);
	}

	// Return supabaseResponse as-is. If you build a different response, copy
	// its cookies over (see redirectWithCookies), or the browser and server
	// sessions will drift apart.
	return supabaseResponse;
};
