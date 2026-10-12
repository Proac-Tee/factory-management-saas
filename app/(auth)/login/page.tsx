import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function Page({ searchParams }: PageProps<"/login">) {
	return (
		<Suspense fallback={<AuthForm mode="login" />}>
			<Login searchParams={searchParams} />
		</Suspense>
	);
}

async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
	const { removed } = await searchParams;
	return (
		<AuthForm
			mode="login"
			notice={removed ? "Your access was removed. Ask an admin if you need it back." : undefined}
		/>
	);
}
