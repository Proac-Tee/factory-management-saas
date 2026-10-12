import "server-only";
import type { JwtPayload } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { isRole, type Role } from "@/entities/roles";
import { db } from "@/lib/db";
import { withRls } from "@/lib/db/rls";
import { allowedEmails, profiles } from "@/lib/db/schema";

/** The signed-in person's name and role, read as them (RLS applies). */
export const findMember = async (claims: JwtPayload) =>
	withRls(claims, async (tx) => {
		const [row] = await tx
			.select({ role: allowedEmails.role, email: allowedEmails.email, name: profiles.fullName })
			.from(allowedEmails)
			.leftJoin(profiles, eq(profiles.id, sql`${claims.sub}::uuid`))
			.where(eq(allowedEmails.email, String(claims.email ?? "").toLowerCase()));
		if (!row || !isRole(row.role)) return null;
		return {
			id: claims.sub as string,
			email: row.email,
			role: row.role as Role,
			name: row.name?.trim() || row.email.split("@")[0],
		};
	});

/**
 * Is this email on the allowed list? Read as the database owner because
 * whoever is signing up isn't signed in yet. Only the yes/no leaves here.
 */
export const isAllowed = async (email: string): Promise<boolean> => {
	const [row] = await db
		.select({ email: allowedEmails.email })
		.from(allowedEmails)
		.where(eq(allowedEmails.email, email));
	return Boolean(row);
};

export type AccessRow = {
	email: string;
	role: Role;
	name: string | null;
	signedUp: boolean;
	lastSignInAt: string | null;
	addedAt: string;
};

/**
 * Everyone on the allowed list with whether they've signed up and when they
 * last signed in. Reads auth.users, so callers must have checked the viewer
 * can manage access.
 */
export const listAccess = async (): Promise<AccessRow[]> => {
	const rows = await db.execute<{
		email: string;
		role: Role;
		name: string | null;
		user_id: string | null;
		last_sign_in_at: string | null;
		created_at: string;
	}>(sql`
		select a.email, a.role, p.full_name as name, u.id as user_id,
			u.last_sign_in_at, a.created_at
		from public.allowed_emails a
		left join auth.users u on lower(u.email) = a.email
		left join public.profiles p on p.id = u.id
		order by (u.id is null), a.email
	`);
	return rows.map((r) => ({
		email: r.email,
		role: r.role,
		name: r.name,
		signedUp: r.user_id !== null,
		lastSignInAt: r.last_sign_in_at ? new Date(r.last_sign_in_at).toISOString() : null,
		addedAt: new Date(r.created_at).toISOString(),
	}));
};

// Changes to the allowed list run as the admin (RLS: admins only).

export const addAllowed = (claims: JwtPayload, email: string, role: Role) =>
	withRls(claims, async (tx) => {
		const rows = await tx
			.insert(allowedEmails)
			.values({ email, role, addedBy: claims.sub })
			.onConflictDoNothing()
			.returning({ email: allowedEmails.email });
		return rows.length > 0;
	});

export const setAllowedRole = (claims: JwtPayload, email: string, role: Role) =>
	withRls(claims, async (tx) => {
		const rows = await tx
			.update(allowedEmails)
			.set({ role })
			.where(eq(allowedEmails.email, email))
			.returning({ email: allowedEmails.email });
		return rows.length > 0;
	});

export const removeAllowed = (claims: JwtPayload, email: string) =>
	withRls(claims, async (tx) => {
		const rows = await tx.delete(allowedEmails).where(eq(allowedEmails.email, email)).returning({ email: allowedEmails.email });
		return rows.length > 0;
	});
