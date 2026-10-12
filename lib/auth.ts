import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Data Access Layer: the one place that reads and verifies the session.
// getClaims() validates the JWT signature, unlike getSession(), which
// trusts whatever is in the cookie.
export const getClaims = cache(async () => {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getClaims();
	if (error || !data) return null;
	return data.claims;
});

export const getCurrentUser = async () => {
	const claims = await getClaims();
	if (!claims) redirect("/login");
	return { id: claims.sub, email: claims.email, claims };
};
