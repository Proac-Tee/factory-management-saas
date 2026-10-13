"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowed } from "@/data-access/members";
import { choosePasswordSchema, newPasswordSchema, resetRequestSchema, signInSchema, signUpProblem, signUpSchema } from "@/entities/account";
import { clearMustChangePassword, setOwnName } from "@/data-access/accounts";
import { getClaims, mustChoosePassword } from "@/lib/auth";
import { firstIssue, formFields } from "@/entities/validation";
import { siteOrigin } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AuthState =
	| { error?: string; message?: string; field?: "email" | "password" | "name"; email?: string; fullName?: string }
	| undefined;

type Field = "email" | "password" | "name";

/** The first problem in a form, keeping the email typed so the form can show it again. */
const failure = (error: Parameters<typeof firstIssue>[0], form: Record<string, string>): AuthState => {
	const { field, message } = firstIssue<string>(error);
	return {
		error: message,
		field: (field === "fullName" ? "name" : field) as Field | undefined,
		email: form.email?.trim(),
		fullName: form.fullName?.trim(),
	};
};

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
	const form = formFields(formData);
	const parsed = signInSchema.safeParse(form);
	if (!parsed.success) return failure(parsed.error, form);
	const credentials = parsed.data;

	const supabase = await createClient();
	const { data, error } = await supabase.auth.signInWithPassword(credentials);
	// Generic message so the form doesn't reveal which emails are registered.
	if (error) {
		return {
			error: "That email and password don't match. Check both, or reset your password.",
			email: credentials.email,
		};
	}

	revalidatePath("/", "layout");
	// A temporary password from an admin: they choose their own first.
	redirect(data.user && mustChoosePassword(data.user) ? "/choose-password" : "/labels");
}

/**
 * First sign-in with a temporary password: saves their own password and
 * name, then stops asking. The temporary password stops working.
 */
export async function choosePassword(_: AuthState, formData: FormData): Promise<AuthState> {
	const claims = await getClaims();
	if (!claims) redirect("/login");
	const form = formFields(formData);
	const parsed = choosePasswordSchema.safeParse(form);
	if (!parsed.success) return failure(parsed.error, form);
	const { password, fullName } = parsed.data;

	const supabase = await createClient();
	const { error } = await supabase.auth.updateUser({ password });
	if (error) {
		const same = error.code === "same_password";
		return {
			error: same ? "Choose a different password from the temporary one." : signUpProblem(error).message,
			field: "password",
			fullName,
		};
	}
	await setOwnName(claims, fullName);
	if (!(await clearMustChangePassword(claims.sub))) {
		return { error: "Your password was saved, but the app couldn't finish. Sign in again with your new password.", fullName };
	}
	// A fresh session, so the app sees the account no longer needs a new password.
	await supabase.auth.refreshSession();
	revalidatePath("/", "layout");
	redirect("/labels");
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
	const form = formFields(formData);
	const parsed = signUpSchema.safeParse(form);
	if (!parsed.success) return failure(parsed.error, form);
	const { fullName, ...credentials } = parsed.data;

	// The database refuses anyone not on the list too; this is just a clearer message.
	if (!(await isAllowed(credentials.email))) {
		return {
			error: "This email isn't on the allowed list yet. Ask an admin to add it, then try again.",
			field: "email",
			email: credentials.email,
		};
	}

	const origin = siteOrigin((await headers()).get("origin"));
	const supabase = await createClient();
	const { data, error } = await supabase.auth.signUp({
		...credentials,
		options: {
			// Read by the on_auth_user_created trigger to fill profiles.full_name.
			data: { full_name: fullName },
			emailRedirectTo: `${origin}/auth/confirm?next=/labels`,
		},
	});
	if (error) {
		// The real reason, for the server logs (Vercel → Logs); the person gets it in plain words.
		console.error("Sign-up failed", { code: error.code, status: error.status, message: error.message });
		return { error: signUpProblem(error).message, email: credentials.email };
	}

	// With email confirmation off, Supabase signs the user in immediately.
	if (data.session) {
		revalidatePath("/", "layout");
		redirect("/labels");
	}
	return { message: "Check your email and open the link to finish creating your account." };
}

export async function requestReset(_: AuthState, formData: FormData): Promise<AuthState> {
	const form = formFields(formData);
	const parsed = resetRequestSchema.safeParse(form);
	if (!parsed.success) return failure(parsed.error, form);
	const { email } = parsed.data;
	const origin = siteOrigin((await headers()).get("origin"));
	const supabase = await createClient();
	await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${origin}/auth/confirm?next=/reset-password`,
	});
	// Same answer either way, so the form doesn't reveal who has an account.
	return { message: `If ${email} has an account, a reset link is on its way. It works for an hour.` };
}

export async function setNewPassword(_: AuthState, formData: FormData): Promise<AuthState> {
	const form = formFields(formData);
	const parsed = newPasswordSchema.safeParse(form);
	if (!parsed.success) return failure(parsed.error, form);
	const { password } = parsed.data;
	const supabase = await createClient();
	const { error } = await supabase.auth.updateUser({ password });
	if (error) return { error: "The reset link has expired. Ask for a new one.", field: "password" };
	revalidatePath("/", "layout");
	redirect("/labels");
}

export async function logout() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	revalidatePath("/", "layout");
	redirect("/login");
}
