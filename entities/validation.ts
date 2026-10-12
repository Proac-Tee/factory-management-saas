// Small helpers shared by every Zod schema in the app. Schemas live next to
// the rules they check (entities/*); these turn Zod's result into the
// { ok, field, message } shape the screens show.

import { z } from "zod";

/** Ids of rows in the database (Postgres gen_random_uuid()). */
export const idSchema = z.uuid({ error: "That link is broken. Go back and try again." });

/** A number within limits, with one message for anything outside them. */
export const rangeSchema = ({ min, max }: { min: number; max: number }, message: string) =>
	z.number({ error: message }).min(min, { error: message }).max(max, { error: message });

/** Trims and collapses inner whitespace, so "  Ember   Snacks " is "Ember Snacks". */
export const tidyText = z.string().transform((s) => s.trim().replace(/\s+/g, " "));

export type Failure<Field extends string = string> = { ok: false; field?: Field; message: string };

/**
 * The first problem in a failed parse: its message, and the top-level field
 * it belongs to so a form can show it next to that field.
 */
export const firstIssue = <Field extends string = string>(error: z.ZodError): Failure<Field> => {
	const issue = error.issues[0];
	const field = typeof issue?.path[0] === "string" ? (issue.path[0] as Field) : undefined;
	return { ok: false, field, message: issue?.message ?? "Something in the form isn't right." };
};

/** A form's fields as strings (files and repeated keys aren't used in this app). */
export const formFields = (form: FormData): Record<string, string> =>
	Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === "string" ? value : ""]));
