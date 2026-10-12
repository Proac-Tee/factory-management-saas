// Who can do what. The same rules are enforced by Postgres row level
// security (drizzle/*_label_studio.sql); this copy decides what the UI shows.

export const ROLES = ["admin", "editor", "operator"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_NAMES: Record<Role, string> = {
	admin: "Admin",
	editor: "Editor",
	operator: "Operator",
};

export const ACTIONS = ["use-labels", "edit-labels", "manage-access"] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_NAMES: Record<Action, string> = {
	"use-labels": "Find, scan and print labels",
	"edit-labels": "Edit labels, sizes and groups",
	"manage-access": "Allow emails, change roles",
};

const ALLOWED: Record<Action, readonly Role[]> = {
	"use-labels": ["admin", "editor", "operator"],
	"edit-labels": ["admin", "editor"],
	"manage-access": ["admin"],
};

export const can = (role: Role | null | undefined, action: Action): boolean =>
	role != null && ALLOWED[action].includes(role);

export const isRole = (value: unknown): value is Role =>
	typeof value === "string" && (ROLES as readonly string[]).includes(value);

/** Emails are compared case-insensitively and without surrounding space. */
export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export const checkEmail = (input: string): { ok: true; email: string } | { ok: false; message: string } => {
	const email = normaliseEmail(input);
	if (email === "") return { ok: false, message: "Enter an email address." };
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return { ok: false, message: "That doesn't look like an email address. Check for typos." };
	}
	return { ok: true, email };
};
