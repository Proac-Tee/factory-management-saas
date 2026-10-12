import { NextResponse } from "next/server";
import { findMember } from "@/data-access/members";
import { getClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Someone still signed in whose email was taken off the allowed list. Pages
// can't clear the session cookie themselves, so they send them here: sign
// out, then show the sign-in page with a notice. Without this, the proxy
// would send a signed-in person from /login straight back to the app.
export async function GET(request: Request) {
	const claims = await getClaims();
	// Only sign out people who really have no access, so another site can't
	// use this link to sign out someone who still does.
	if (claims && !(await findMember(claims))) {
		const supabase = await createClient();
		await supabase.auth.signOut();
	}
	return NextResponse.redirect(new URL("/login?removed=1", request.url));
}
