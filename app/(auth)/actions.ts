"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

const readCredentials = (formData: FormData) => {
	const email = String(formData.get("email") ?? "").trim();
	const password = String(formData.get("password") ?? "");
	if (!email || !password) return { error: "Email and password are required." };
	if (password.length < 8)
		return { error: "Password must be at least 8 characters." };
	return { email, password };
};

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
	const credentials = readCredentials(formData);
	if ("error" in credentials) return credentials;

	const supabase = await createClient();
	const { error } = await supabase.auth.signInWithPassword(credentials);
	// Generic message so the form doesn't reveal which emails are registered.
	if (error) return { error: "Invalid email or password." };

	revalidatePath("/", "layout");
	redirect("/dashboard");
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
	const credentials = readCredentials(formData);
	if ("error" in credentials) return credentials;
	const fullName = String(formData.get("fullName") ?? "").trim();

	const origin = (await headers()).get("origin");
	const supabase = await createClient();
	const { data, error } = await supabase.auth.signUp({
		...credentials,
		options: {
			// Read by the on_auth_user_created trigger to fill profiles.full_name.
			data: { full_name: fullName || null },
			emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
		},
	});
	if (error) return { error: error.message };

	// With email confirmation off, Supabase signs the user in immediately.
	if (data.session) {
		revalidatePath("/", "layout");
		redirect("/dashboard");
	}
	return { message: "Check your email to confirm your account." };
}

export async function logout() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	revalidatePath("/", "layout");
	redirect("/login");
}
