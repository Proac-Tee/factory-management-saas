// Who can do what. The same rules are enforced by Postgres row level
// security (drizzle/*_label_studio.sql); this copy decides what the UI shows.

import { z } from "zod";

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

export const roleSchema = z.enum(ROLES, { error: "Pick a role." });

export const isRole = (value: unknown): value is Role => roleSchema.safeParse(value).success;

/**
 * An email as typed: compared case-insensitively and without surrounding
 * space. Same pattern as the allowed_emails_format check in the database.
 */
export const emailSchema = z
	.string({ error: "Enter an email address." })
	.trim()
	.toLowerCase()
	.min(1, { error: "Enter an email address." })
	.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { error: "That doesn't look like an email address. Check for typos." });

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export const checkEmail = (input: string): { ok: true; email: string } | { ok: false; message: string } => {
	const result = emailSchema.safeParse(input);
	return result.success ? { ok: true, email: result.data } : { ok: false, message: result.error.issues[0].message };
};
