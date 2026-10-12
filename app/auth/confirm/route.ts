import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// The email link types Supabase sends (EmailOtpType); anything else is refused.
const otpType = z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]).nullable().catch(null);

// Target of Supabase email links (signup confirmation, magic link, etc.).
// Handles both the PKCE `code` flow and the `token_hash` email template.
export async function GET(request: NextRequest) {
	const { searchParams, origin } = request.nextUrl;
	const code = searchParams.get("code");
	const tokenHash = searchParams.get("token_hash");
	const type = otpType.parse(searchParams.get("type"));
	const safeNext = safeRedirectPath(searchParams.get("next"), origin);

	const supabase = await createClient();
	const { error } = code
		? await supabase.auth.exchangeCodeForSession(code)
		: tokenHash && type
			? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
			: { error: new Error("Missing code or token_hash") };

	return NextResponse.redirect(
		new URL(error ? "/auth/error" : safeNext, origin),
	);
}
