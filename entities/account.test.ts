import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "./account";
import { firstIssue } from "./validation";

const problem = (result: ReturnType<typeof signInSchema.safeParse>) =>
	result.success ? null : firstIssue(result.error);

describe("sign-in forms", () => {
	it("tidies the email and keeps the password as typed", () => {
		expect(signInSchema.parse({ email: " Zoe@EmberSnacks.co.uk ", password: " secret12 " })).toEqual({
			email: "zoe@embersnacks.co.uk",
			password: " secret12 ",
		});
	});

	it("says which field to fix", () => {
		expect(problem(signInSchema.safeParse({ email: "zoe", password: "secret12" }))).toMatchObject({ field: "email" });
		expect(problem(signInSchema.safeParse({ email: "zoe@ember.co", password: "" }))).toEqual({
			ok: false,
			field: "password",
			message: "Enter your password.",
		});
		expect(problem(signInSchema.safeParse({ email: "zoe@ember.co", password: "short" }))).toMatchObject({
			message: "Passwords are at least 8 characters.",
		});
	});

	it("needs a name to sign up", () => {
		const result = signUpSchema.safeParse({ email: "zoe@ember.co", password: "secret12", fullName: "  " });
		expect(result.success ? null : firstIssue(result.error)).toMatchObject({ field: "fullName" });
	});
});
