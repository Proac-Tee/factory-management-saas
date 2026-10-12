"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthState, login, signup } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
	const isSignup = mode === "signup";
	const [state, action, pending] = useActionState<AuthState, FormData>(
		isSignup ? signup : login,
		undefined,
	);

	return (
		<form action={action} className="flex w-full max-w-sm flex-col gap-4">
			<h1 className="text-2xl font-semibold">
				{isSignup ? "Create an account" : "Sign in"}
			</h1>
			{isSignup && (
				<label className="flex flex-col gap-1 text-sm">
					Full name
					<input
						name="fullName"
						autoComplete="name"
						className="rounded border px-3 py-2"
					/>
				</label>
			)}
			<label className="flex flex-col gap-1 text-sm">
				Email
				<input
					name="email"
					type="email"
					autoComplete="email"
					required
					className="rounded border px-3 py-2"
				/>
			</label>
			<label className="flex flex-col gap-1 text-sm">
				Password
				<input
					name="password"
					type="password"
					autoComplete={isSignup ? "new-password" : "current-password"}
					minLength={8}
					required
					className="rounded border px-3 py-2"
				/>
			</label>
			{state?.error && (
				<p role="alert" className="text-sm text-red-600">
					{state.error}
				</p>
			)}
			{state?.message && (
				<p role="status" className="text-sm text-green-700">
					{state.message}
				</p>
			)}
			<button
				type="submit"
				disabled={pending}
				className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
			>
				{pending ? "Please wait…" : isSignup ? "Sign up" : "Sign in"}
			</button>
			<p className="text-sm">
				{isSignup ? "Already have an account? " : "No account yet? "}
				<Link href={isSignup ? "/login" : "/signup"} className="underline">
					{isSignup ? "Sign in" : "Sign up"}
				</Link>
			</p>
		</form>
	);
}
