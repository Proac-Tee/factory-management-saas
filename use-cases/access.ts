import "server-only";
import { addAllowed, removeAllowed, setAllowedRole } from "@/data-access/members";
import { checkEmail, isRole, ROLE_NAMES } from "@/entities/roles";
import { requireMember } from "@/lib/auth";

export type AccessResult = { ok: true; message: string } | { ok: false; field?: "email" | "role"; message: string };

/** Puts an email on the allowed list so that person can create their password. */
export const allowEmail = async (emailInput: string, roleInput: string): Promise<AccessResult> => {
	const admin = await requireMember("manage-access");
	const email = checkEmail(emailInput);
	if (!email.ok) return { ok: false, field: "email", message: email.message };
	if (!isRole(roleInput)) return { ok: false, field: "role", message: "Pick a role." };
	const added = await addAllowed(admin.claims, email.email, roleInput);
	if (!added) return { ok: false, field: "email", message: "That email is already on the list. Change its role below instead." };
	return { ok: true, message: `${email.email} can now create a password and sign in as ${ROLE_NAMES[roleInput].toLowerCase()}.` };
};

export const changeRole = async (email: string, roleInput: string): Promise<AccessResult> => {
	const admin = await requireMember("manage-access");
	if (!isRole(roleInput)) return { ok: false, field: "role", message: "Pick a role." };
	if (email === admin.email && roleInput !== "admin") {
		return { ok: false, field: "role", message: "You can't take away your own admin role. Ask another admin." };
	}
	const changed = await setAllowedRole(admin.claims, email, roleInput);
	return changed ? { ok: true, message: "Role saved" } : { ok: false, message: "That email isn't on the list any more. Refresh the page." };
};

/**
 * Takes an email off the list. Anyone signed in with it loses access on their
 * next click. You can't remove or demote yourself, so an admin always remains.
 */
export const removeAccess = async (email: string): Promise<AccessResult> => {
	const admin = await requireMember("manage-access");
	if (email === admin.email) return { ok: false, message: "You can't remove your own access. Ask another admin." };
	const removed = await removeAllowed(admin.claims, email);
	return removed ? { ok: true, message: `${email} can no longer sign in.` } : { ok: false, message: "That email isn't on the list any more. Refresh the page." };
};
