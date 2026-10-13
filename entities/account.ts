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

/**
 * A new password typed twice, so a typo can't lock someone out. Checked only
 * once the rest of the form is right, and left out of what's returned.
 */
const confirmed = <T extends { password: string; confirmPassword: string }>(schema: z.ZodType<T>) =>
	schema
		.refine((form) => form.password === form.confirmPassword, {
			path: ["confirmPassword"],
			error: "The two passwords don't match. Type the same password in both boxes.",
		})
		.transform(({ confirmPassword, ...rest }) => {
			void confirmPassword;
			return rest;
		});

const confirmPassword = z.string().min(1, { error: "Type your password again to confirm it." });

export const signUpSchema = confirmed(
	signInSchema.extend({
		fullName: z
			.string()
			.trim()
			.min(1, { error: "Enter your name, so labels you edit show who changed them." })
			.max(80, { error: "Keep your name under 80 characters." }),
		confirmPassword,
	}),
);

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = confirmed(
	z.object({
		password: z.string().min(MIN_PASSWORD, { error: `Use at least ${MIN_PASSWORD} characters.` }),
		confirmPassword,
	}),
);
