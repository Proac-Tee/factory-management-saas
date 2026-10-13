import "server-only";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { createAccount, resetToTemporaryPassword } from "@/data-access/accounts";
import { type AccessRow, addAllowed, listAccess, removeAllowed, setAllowedRole } from "@/data-access/members";
import { temporaryPassword } from "@/entities/temporary-password";
import { emailSchema, ROLE_NAMES, roleSchema } from "@/entities/roles";
import { firstIssue } from "@/entities/validation";
import { requireMember } from "@/lib/auth";

export type { AccessRow };

export type AccessResult =
	| { ok: true; message: string; /** Shown once to the admin, to hand over; never stored or logged. */ temporaryPassword?: string }
	| { ok: false; field?: "email" | "role"; message: string };

const newTemporaryPassword = () => temporaryPassword((n) => new Uint8Array(randomBytes(n)));

const NOT_ON_LIST = "That email isn't on the list any more. Refresh the page.";

/** Everyone on the allowed list, for admins. */
export const getAccess = async (): Promise<{ rows: AccessRow[]; myEmail: string }> => {
	const admin = await requireMember("manage-access");
	return { rows: await listAccess(), myEmail: admin.email };
};

const allowSchema = z.object({ email: emailSchema, role: roleSchema });

/**
 * Puts an email on the allowed list and makes its account, with a temporary
 * password for the admin to hand over. No email is sent; the person chooses
 * their own password when they first sign in.
 */
export const allowEmail = async (input: unknown): Promise<AccessResult> => {
	const admin = await requireMember("manage-access");
	const parsed = allowSchema.safeParse(input);
	if (!parsed.success) return firstIssue<"email" | "role">(parsed.error);
	const { email, role } = parsed.data;
	const added = await addAllowed(admin.claims, email, role);
	if (!added) return { ok: false, field: "email", message: "That email is already on the list. Change its role below instead." };

	const password = newTemporaryPassword();
	const account = await createAccount(email, password);
	if (account.ok) {
		return { ok: true, message: `${email} can sign in as ${ROLE_NAMES[role].toLowerCase()}.`, temporaryPassword: password };
	}
	if (account.reason === "exists") {
		return { ok: true, message: `${email} already had an account, so they keep their password. Use Reset password if they've forgotten it.` };
	}
	// Leave nothing half-done, so adding the email again works.
	await removeAllowed(admin.claims, email);
	return { ok: false, message: "The account couldn't be made. Try again; if it keeps happening, check the app's Supabase settings." };
};

/** A new temporary password for someone who's forgotten theirs (there's no reset email). */
export const resetPassword = async (input: unknown): Promise<AccessResult> => {
	await requireMember("manage-access");
	const parsed = emailSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: NOT_ON_LIST };
	const password = newTemporaryPassword();
	const reset = await resetToTemporaryPassword(parsed.data, password);
	if (reset.ok) return { ok: true, message: "Password reset", temporaryPassword: password };
	return {
		ok: false,
		message: reset.reason === "missing" ? "They don't have an account yet. Remove the email and allow it again." : "The password couldn't be reset. Try again.",
	};
};

export const changeRole = async (input: unknown): Promise<AccessResult> => {
	const admin = await requireMember("manage-access");
	const parsed = allowSchema.safeParse(input);
	if (!parsed.success) return firstIssue<"email" | "role">(parsed.error);
	const { email, role } = parsed.data;
	if (email === admin.email && role !== "admin") {
		return { ok: false, field: "role", message: "You can't take away your own admin role. Ask another admin." };
	}
	const changed = await setAllowedRole(admin.claims, email, role);
	return changed ? { ok: true, message: "Role saved" } : { ok: false, message: NOT_ON_LIST };
};

/**
 * Takes an email off the list. Anyone signed in with it loses access on their
 * next click. You can't remove or demote yourself, so an admin always remains.
 */
export const removeAccess = async (input: unknown): Promise<AccessResult> => {
	const admin = await requireMember("manage-access");
	const parsed = emailSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: NOT_ON_LIST };
	const email = parsed.data;
	if (email === admin.email) return { ok: false, message: "You can't remove your own access. Ask another admin." };
	const removed = await removeAllowed(admin.claims, email);
	return removed ? { ok: true, message: `${email} can no longer sign in.` } : { ok: false, message: NOT_ON_LIST };
};
