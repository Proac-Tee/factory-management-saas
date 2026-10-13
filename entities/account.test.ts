import { describe, expect, it } from "vitest";
import { signInSchema, signUpProblem, signUpSchema } from "./account";
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

describe("signUpProblem", () => {
	it("says what went wrong in plain words", () => {
		expect(signUpProblem({ code: "user_already_exists", message: "User already registered" }).exists).toBe(true);
		expect(signUpProblem({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }).message).toMatch(/Too many/);
		expect(signUpProblem({ status: 500, message: "Error sending confirmation email" }).message).toMatch(/couldn't be sent/);
		expect(signUpProblem({ code: "email_address_not_authorized", message: "Email address not authorized" }).message).toMatch(/couldn't be sent/);
		expect(signUpProblem({ code: "weak_password", message: "Password is known to be weak" }).message).toMatch(/stronger/);
		expect(signUpProblem({ code: "unexpected_failure", message: "Database error saving new user" }).message).toMatch(/allowed list/);
		expect(signUpProblem({ message: "something else" }).message).toMatch(/couldn't be created/);
	});
});
