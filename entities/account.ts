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
