import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Target of Supabase email links (signup confirmation, magic link, etc.).
// Handles both the PKCE `code` flow and the `token_hash` email template.
export async function GET(request: NextRequest) {
	const { searchParams, origin } = request.nextUrl;
	const code = searchParams.get("code");
	const tokenHash = searchParams.get("token_hash");
	const type = searchParams.get("type") as EmailOtpType | null;
	const next = searchParams.get("next") ?? "/dashboard";
	// Only allow same-site relative paths to avoid an open redirect.
	const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

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
