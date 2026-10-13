// What the sign-in, sign-up and password forms accept.

import { z } from "zod";
import { emailSchema } from "./roles";

export const MIN_PASSWORD = 8;

const password = (tooShort: string) =>
	z.string().min(1, { error: "Enter your password." }).min(MIN_PASSWORD, { error: tooShort });

export const signInSchema = z.object({
	email: emailSchema,
	password: password(`Passwords are at least ${MIN_PASSWORD} characters.`),
});

export const signUpSchema = signInSchema.extend({
	fullName: z
		.string()
		.trim()
		.min(1, { error: "Enter your name, so labels you edit show who changed them." })
		.max(80, { error: "Keep your name under 80 characters." }),
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z.object({
	password: z.string().min(MIN_PASSWORD, { error: `Use at least ${MIN_PASSWORD} characters.` }),
});

/** What Supabase says when a sign-up fails (AuthError's code, status and message). */
export type SignUpFailure = { code?: string; status?: number; message: string };

/**
 * A sign-up failure in plain words, with what to do about it. Supabase's
 * built-in email sender only mails the project's own team and only a few
 * times an hour, so most failures for new staff are about the email.
 */
export const signUpProblem = ({ code, message }: SignUpFailure): { exists: boolean; message: string } => {
	const text = message.toLowerCase();
	if (code === "user_already_exists" || code === "email_exists" || /already registered|already exists/.test(text)) {
		return { exists: true, message: "You already have an account. Sign in instead." };
	}
	if (code === "over_email_send_rate_limit" || /rate limit/.test(text)) {
		return {
			exists: false,
			message: "Too many sign-up emails were sent in the last hour. Try again later, or ask an admin to set up the app's email sending.",
		};
	}
	if (code === "email_address_not_authorized" || /error sending|not authorized/.test(text)) {
		return {
			exists: false,
			message: "The confirmation email couldn't be sent to this address. Ask an admin to set up the app's email sending, then try again.",
		};
	}
	if (code === "weak_password" || /password/.test(text)) {
		return { exists: false, message: "Choose a stronger password: at least 8 characters, not a common one." };
	}
	if (code === "signup_disabled" || /signups? not allowed|disabled/.test(text)) {
		return { exists: false, message: "New accounts are switched off at the moment. Ask an admin." };
	}
	if (/database error saving new user/.test(text)) {
		return { exists: false, message: "This email isn't on the allowed list yet. Ask an admin to add it, then try again." };
	}
	return { exists: false, message: "Your account couldn't be created. Try again, and if it keeps happening tell an admin." };
};
