"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowed } from "@/data-access/members";
import { checkEmail } from "@/entities/roles";
import { createClient } from "@/lib/supabase/server";

export type AuthState =
	| { error?: string; message?: string; field?: "email" | "password" | "name"; email?: string }
	| undefined;

const MIN_PASSWORD = 8;

const readCredentials = (formData: FormData) => {
	const email = checkEmail(String(formData.get("email") ?? ""));
	const password = String(formData.get("password") ?? "");
	if (!email.ok) return { error: email.message, field: "email" as const };
	if (password === "") return { error: "Enter your password.", field: "password" as const, email: email.email };
	if (password.length < MIN_PASSWORD) {
		return { error: `Passwords are at least ${MIN_PASSWORD} characters.`, field: "password" as const, email: email.email };
	}
	return { email: email.email, password };
};

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
	const credentials = readCredentials(formData);
	if ("error" in credentials) return credentials;

	const supabase = await createClient();
	const { error } = await supabase.auth.signInWithPassword(credentials);
	// Generic message so the form doesn't reveal which emails are registered.
	if (error) {
		return {
			error: "That email and password don't match. Check both, or reset your password.",
			email: credentials.email,
		};
	}

	revalidatePath("/", "layout");
	redirect("/labels");
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
	const credentials = readCredentials(formData);
	if ("error" in credentials) return credentials;
	const fullName = String(formData.get("fullName") ?? "").trim();
	if (fullName === "") return { error: "Enter your name, so labels you edit show who changed them.", field: "name", email: credentials.email };

	// The database refuses anyone not on the list too; this is just a clearer message.
	if (!(await isAllowed(credentials.email))) {
		return {
			error: "This email isn't on the allowed list yet. Ask an admin to add it, then try again.",
			field: "email",
			email: credentials.email,
		};
	}

	const origin = (await headers()).get("origin");
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
		const exists = /already registered|already exists/i.test(error.message);
		return {
			error: exists ? "You already have an account. Sign in instead." : "Your account couldn't be created. Try again.",
			email: credentials.email,
		};
	}

	// With email confirmation off, Supabase signs the user in immediately.
	if (data.session) {
		revalidatePath("/", "layout");
		redirect("/labels");
	}
	return { message: "Check your email and open the link to finish creating your account." };
}

export async function requestReset(_: AuthState, formData: FormData): Promise<AuthState> {
	const email = checkEmail(String(formData.get("email") ?? ""));
	if (!email.ok) return { error: email.message, field: "email" };
	const origin = (await headers()).get("origin");
	const supabase = await createClient();
	await supabase.auth.resetPasswordForEmail(email.email, {
		redirectTo: `${origin}/auth/confirm?next=/reset-password`,
	});
	// Same answer either way, so the form doesn't reveal who has an account.
	return { message: `If ${email.email} has an account, a reset link is on its way. It works for an hour.` };
}

export async function setNewPassword(_: AuthState, formData: FormData): Promise<AuthState> {
	const password = String(formData.get("password") ?? "");
	if (password.length < MIN_PASSWORD) {
		return { error: `Use at least ${MIN_PASSWORD} characters.`, field: "password" };
	}
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
