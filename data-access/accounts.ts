import "server-only";
import type { JwtPayload } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { MUST_CHANGE_PASSWORD } from "@/entities/temporary-password";
import { db } from "@/lib/db";
import { withRls } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";

// Accounts made and reset by admins, with a temporary password and no email.
// Callers (use-cases/access.ts) check the person is an admin first.

export type AccountChange = { ok: true } | { ok: false; reason: "exists" | "missing" | "failed" };

const userIdFor = async (email: string): Promise<string | null> => {
	const rows = await db.execute<{ id: string }>(sql`select id from auth.users where lower(email) = ${email} limit 1`);
	return rows[0]?.id ?? null;
};

/**
 * An account that's ready to sign in with `password` (already confirmed, so
 * no email), which must choose its own password first. The email must be on
 * the allowed list already: the sign-up trigger checks.
 */
export const createAccount = async (email: string, password: string): Promise<AccountChange> => {
	const { error } = await createAdminClient().auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		app_metadata: { [MUST_CHANGE_PASSWORD]: true },
	});
	if (!error) return { ok: true };
	if (error.code === "email_exists" || error.code === "user_already_exists" || /already/i.test(error.message)) {
		return { ok: false, reason: "exists" };
	}
	console.error("Creating an account failed", { code: error.code, status: error.status, message: error.message });
	return { ok: false, reason: "failed" };
};

/** Gives an account a new temporary password and signs it out everywhere. */
export const resetToTemporaryPassword = async (email: string, password: string): Promise<AccountChange> => {
	const id = await userIdFor(email);
	if (!id) return { ok: false, reason: "missing" };
	const admin = createAdminClient();
	const { error } = await admin.auth.admin.updateUserById(id, {
		password,
		app_metadata: { [MUST_CHANGE_PASSWORD]: true },
	});
	if (error) {
		console.error("Resetting a password failed", { code: error.code, status: error.status, message: error.message });
		return { ok: false, reason: "failed" };
	}
	// Anyone still signed in with the old password is signed out (their refresh tokens go with the sessions).
	await db.execute(sql`delete from auth.sessions where user_id = ${id}::uuid`);
	return { ok: true };
};

/** Once someone has chosen their own password, the app stops asking. */
export const clearMustChangePassword = async (userId: string): Promise<boolean> => {
	const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
		app_metadata: { [MUST_CHANGE_PASSWORD]: false },
	});
	return !error;
};

/** The signed-in person's own name (their profile; RLS lets them change only theirs). */
export const setOwnName = (claims: JwtPayload, fullName: string) =>
	withRls(claims, async (tx) => {
		await tx.update(profiles).set({ fullName, updatedAt: sql`now()` }).where(eq(profiles.id, claims.sub as string));
	});
