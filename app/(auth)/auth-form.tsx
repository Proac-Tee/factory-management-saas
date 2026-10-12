"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field } from "@/components/field";
import { MailIcon } from "@/components/icons";
import { ErrorLine, fieldClass, primaryButton, SavedLine } from "@/components/ui";
import { type AuthState, login, requestReset, setNewPassword, signup } from "./actions";

type Mode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<Mode, { title: string; intro: string; button: string; busy: string }> = {
	login: {
		title: "Sign in",
		intro: "Ember Factory OS. Use the work email your admin added to the allowed list.",
		button: "Sign in",
		busy: "Signing in…",
	},
	signup: {
		title: "Create your password",
		intro: "For first-time sign in. It only works if an admin has added your email to the allowed list.",
		button: "Create account",
		busy: "Creating your account…",
	},
	forgot: {
		title: "Reset your password",
		intro: "We'll email you a link to set a new one.",
		button: "Send the reset link",
		busy: "Sending…",
	},
	reset: {
		title: "Set a new password",
		intro: "Use at least 8 characters. You stay signed in after saving.",
		button: "Save new password",
		busy: "Saving…",
	},
};

const ACTIONS = { login, signup, forgot: requestReset, reset: setNewPassword };

export function AuthForm({ mode, notice }: { mode: Mode; notice?: string }) {
	const [state, action, pending] = useActionState<AuthState, FormData>(ACTIONS[mode], undefined);
	const [showPassword, setShowPassword] = useState(false);
	const copy = COPY[mode];
	const fieldError = (field: "email" | "password" | "name") => (state?.field === field ? state.error : undefined);
	const otherError = state?.error && !state.field ? state.error : undefined;

	const passwordField = (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-baseline justify-between">
				<label htmlFor="password" className="text-sm leading-[18px] font-medium text-graphite">
					{mode === "login" ? "Password" : "New password"}
				</label>
				{mode === "login" && (
					<Link href="/forgot-password" className="text-sm font-bold underline underline-offset-2">
						Forgot it?
					</Link>
				)}
			</div>
			<div className="relative">
				<input
					id="password"
					name="password"
					type={showPassword ? "text" : "password"}
					autoComplete={mode === "login" ? "current-password" : "new-password"}
					minLength={8}
					required
					aria-invalid={Boolean(fieldError("password"))}
					aria-describedby={fieldError("password") ? "password-error" : undefined}
					className={`${fieldClass} pr-20`}
				/>
				<button
					type="button"
					onClick={() => setShowPassword((s) => !s)}
					aria-pressed={showPassword}
					className="absolute top-0 right-0 flex h-tap items-center px-4 text-sm font-bold"
				>
					{showPassword ? "Hide" : "Show"}
				</button>
			</div>
			{fieldError("password") && <ErrorLine id="password-error" message={fieldError("password")!} />}
		</div>
	);

	return (
		<form action={action} className="flex w-full max-w-[400px] flex-1 flex-col gap-5 md:flex-none">
			<div className="flex flex-col gap-3 pb-2">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src="/ember-logo.png" alt="Ember" width={96} height={56} className="mb-6" />
				<h1 className="text-2xl leading-12 font-black tracking-tight">{copy.title}</h1>
				<p className="text-base leading-normal text-graphite">{copy.intro}</p>
			</div>

			{notice && <ErrorLine message={notice} />}

			{mode === "signup" && (
				<Field label="Your name" name="fullName" autoComplete="name" required maxLength={60} defaultValue="" error={fieldError("name")} />
			)}

			{mode !== "reset" && (
				<div className="flex flex-col gap-1.5">
					<label htmlFor="email" className="text-sm leading-[18px] font-medium text-graphite">
						Work email
					</label>
					<div className="relative">
						<MailIcon size={20} className="pointer-events-none absolute top-[18px] left-4 text-ink" />
						<input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							autoCapitalize="none"
							spellCheck={false}
							required
							defaultValue={state?.email}
							aria-invalid={Boolean(fieldError("email"))}
							aria-describedby={fieldError("email") ? "email-error" : undefined}
							className={`${fieldClass} pl-12`}
						/>
					</div>
					{fieldError("email") && <ErrorLine id="email-error" message={fieldError("email")!} />}
				</div>
			)}

			{(mode === "login" || mode === "signup" || mode === "reset") && passwordField}

			<div className="mt-auto flex flex-col gap-4 pt-6 md:mt-4">
				{otherError && <ErrorLine message={otherError} />}
				{state?.message && <SavedLine>{state.message}</SavedLine>}
				<button type="submit" disabled={pending} className={`${primaryButton} h-[60px] w-full text-lg`}>
					{pending ? copy.busy : copy.button}
				</button>
				<p className="border-t border-rule pt-4 text-sm leading-5 text-graphite">
					{mode === "login" && (
						<>
							First time here?{" "}
							<Link href="/signup" className="font-bold text-ink underline underline-offset-2">
								Create your password
							</Link>
							. It only works if your email is on the allowed list.
						</>
					)}
					{mode !== "login" && (
						<>
							Have a password already?{" "}
							<Link href="/login" className="font-bold text-ink underline underline-offset-2">
								Sign in
							</Link>
							.
						</>
					)}
				</p>
			</div>
		</form>
	);
}
