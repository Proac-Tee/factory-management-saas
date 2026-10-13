import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getClaims, mustChoosePassword } from "@/lib/auth";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Choose your password" };

// After signing in with a temporary password from an admin. Everyone else
// is sent on: signed out to sign in, already set up to the labels.
export default function Page() {
	return (
		<Suspense fallback={<AuthForm mode="choose" />}>
			<Choose />
		</Suspense>
	);
}

async function Choose() {
	const claims = await getClaims();
	if (!claims) redirect("/login");
	if (!mustChoosePassword(claims)) redirect("/labels");
	return <AuthForm mode="choose" />;
}
