import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { type Action, can, type Role } from "@/entities/roles";
import { findMember } from "@/data-access/members";
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

export type Member = {
	id: string;
	email: string;
	name: string;
	role: Role;
	claims: NonNullable<Awaited<ReturnType<typeof getClaims>>>;
};

/**
 * The signed-in person and their role. Someone signed in whose email has
 * been taken off the allowed list is sent back to sign in.
 */
export const getMember = cache(async (): Promise<Member> => {
	const user = await getCurrentUser();
	const member = await findMember(user.claims);
	if (!member) redirect("/auth/removed");
	return { ...member, claims: user.claims };
});

/**
 * For pages and actions: the member, if their role allows the action.
 * Every action calls this itself; a hidden button isn't a permission.
 */
export const requireMember = async (action: Action): Promise<Member> => {
	const member = await getMember();
	if (!can(member.role, action)) redirect("/labels?denied=1");
	return member;
};
