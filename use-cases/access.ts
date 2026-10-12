import "server-only";
import { z } from "zod";
import { type AccessRow, addAllowed, listAccess, removeAllowed, setAllowedRole } from "@/data-access/members";
import { emailSchema, ROLE_NAMES, roleSchema } from "@/entities/roles";
import { firstIssue } from "@/entities/validation";
import { requireMember } from "@/lib/auth";

export type { AccessRow };

export type AccessResult = { ok: true; message: string } | { ok: false; field?: "email" | "role"; message: string };

const NOT_ON_LIST = "That email isn't on the list any more. Refresh the page.";

/** Everyone on the allowed list, for admins. */
export const getAccess = async (): Promise<{ rows: AccessRow[]; myEmail: string }> => {
	const admin = await requireMember("manage-access");
	return { rows: await listAccess(), myEmail: admin.email };
};

const allowSchema = z.object({ email: emailSchema, role: roleSchema });

/** Puts an email on the allowed list so that person can create their password. */
export const allowEmail = async (input: unknown): Promise<AccessResult> => {
	const admin = await requireMember("manage-access");
	const parsed = allowSchema.safeParse(input);
	if (!parsed.success) return firstIssue<"email" | "role">(parsed.error);
	const { email, role } = parsed.data;
	const added = await addAllowed(admin.claims, email, role);
	if (!added) return { ok: false, field: "email", message: "That email is already on the list. Change its role below instead." };
	return { ok: true, message: `${email} can now create a password and sign in as ${ROLE_NAMES[role].toLowerCase()}.` };
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
