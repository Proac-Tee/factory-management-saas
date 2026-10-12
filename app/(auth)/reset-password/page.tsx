import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Set a new password" };

// Reached from the reset email link, which signs the person in first
// (app/auth/confirm). The proxy sends anyone signed out to /login.
export default function Page() {
	return <AuthForm mode="reset" />;
}
