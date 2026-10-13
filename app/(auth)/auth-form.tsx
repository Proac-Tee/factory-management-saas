"use client";

import Link from "next/link";
import { type ChangeEvent, useActionState, useState } from "react";
import { Field } from "@/components/field";
import { CheckIcon, MailIcon } from "@/components/icons";
import { Spinner } from "@/components/spinner";
import { button, ErrorLine, fieldClass, SavedLine } from "@/components/ui";
import { type AuthState, login, requestReset, setNewPassword, signup } from "./actions";

type Mode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<Mode, { title: string; intro: string; button: string; busy: string }> = {
	login: {
		title: "Sign in",
		intro: "Use your work email.",
		button: "Sign in",
		busy: "Signing in…",
	},
	signup: {
		title: "Create your password",
		intro: "First time here? An admin adds your work email first, then you choose a password.",
		button: "Create password",
		busy: "Creating…",
	},
	forgot: {
		title: "Reset your password",
		intro: "We'll email you a link to set a new one.",
		button: "Send reset link",
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
	// Whether the two new passwords match, once the second has been typed and left.
	const [match, setMatch] = useState<"same" | "different" | null>(null);
	const copy = COPY[mode];
	const confirming = mode === "signup" || mode === "reset";
	const fieldError = (field: "email" | "password" | "confirm" | "name") => (state?.field === field ? state.error : undefined);

	// The form clears after each try, so the match hint starts over too.
	const [lastState, setLastState] = useState(state);
	if (lastState !== state) {
		setLastState(state);
		setMatch(null);
	}

	const checkMatch = (form: HTMLFormElement | null, typing: boolean) => {
		const password = (form?.elements.namedItem("password") as HTMLInputElement | null)?.value ?? "";
		const confirm = (form?.elements.namedItem("confirmPassword") as HTMLInputElement | null)?.value ?? "";
		if (!confirm) return setMatch(null);
		// While typing, only say when they match; a mismatch waits until they leave the box.
		if (password === confirm) setMatch("same");
		else if (!typing || match !== null) setMatch("different");
	};
	const onPasswordInput = (e: ChangeEvent<HTMLInputElement>) => match !== null && checkMatch(e.currentTarget.form, false);
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
					onChange={confirming ? onPasswordInput : undefined}
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

	const confirmError = fieldError("confirm") ?? (match === "different" ? "The two passwords don't match yet." : undefined);
	const confirmField = (
		<div className="flex flex-col gap-1.5">
			<label htmlFor="confirmPassword" className="text-sm leading-[18px] font-medium text-graphite">
				Type it again
			</label>
			<input
				id="confirmPassword"
				name="confirmPassword"
				type={showPassword ? "text" : "password"}
				autoComplete="new-password"
				required
				onChange={(e) => checkMatch(e.currentTarget.form, true)}
				onBlur={(e) => checkMatch(e.currentTarget.form, false)}
				aria-invalid={Boolean(confirmError)}
				aria-describedby={confirmError ? "confirm-error" : match === "same" ? "confirm-ok" : undefined}
				className={fieldClass}
			/>
			{confirmError ? (
				<ErrorLine id="confirm-error" message={confirmError} />
			) : (
				match === "same" && (
					<p id="confirm-ok" className="flex items-center gap-2 text-sm leading-5 font-bold text-pass">
						<CheckIcon size={18} strokeWidth={2.5} className="shrink-0" />
						Passwords match
					</p>
				)
			)}
		</div>
	);

	return (
		<form
			action={action}
			onSubmit={(e) => {
				// A typo in the second box is caught here, before anything is sent or cleared.
				const form = e.currentTarget;
				const password = (form.elements.namedItem("password") as HTMLInputElement | null)?.value;
				const confirm = form.elements.namedItem("confirmPassword") as HTMLInputElement | null;
				if (confirming && confirm && confirm.value && confirm.value !== password) {
					e.preventDefault();
					setMatch("different");
					confirm.focus();
				}
			}}
			className="flex w-full max-w-[400px] flex-1 flex-col gap-5 md:flex-none">
			<div className="flex flex-col gap-3 pb-2">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src="/ember-logo.png" alt="Ember" width={96} height={56} className="mb-6" />
				<h1 className="text-2xl leading-12 font-black tracking-tight">{copy.title}</h1>
				<p className="text-base leading-normal text-graphite">{copy.intro}</p>
			</div>

			{notice && <ErrorLine message={notice} />}

			{mode === "signup" && (
				<Field
					label="Your name"
					name="fullName"
					autoComplete="name"
					required
					maxLength={60}
					defaultValue={state?.fullName ?? ""}
					error={fieldError("name")}
				/>
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

			{(mode === "login" || confirming) && passwordField}
			{confirming && confirmField}

			<div className="mt-auto flex flex-col gap-4 pt-6 md:mt-4">
				{otherError && <ErrorLine message={otherError} />}
				{state?.message && <SavedLine>{state.message}</SavedLine>}
				<button type="submit" disabled={pending} className={`${button({ size: "xl" })} w-full`}>
					{pending && <Spinner size={20} />}
					{pending ? copy.busy : copy.button}
				</button>
				<p className="border-t border-rule pt-4 text-sm leading-5 text-graphite">
					{mode === "login" && (
						<>
							First time here?{" "}
							<Link href="/signup" className="font-bold text-ink underline underline-offset-2">
								Create your password
							</Link>
						</>
					)}
					{mode !== "login" && (
						<>
							Have a password already?{" "}
							<Link href="/login" className="font-bold text-ink underline underline-offset-2">
								Sign in
							</Link>
						</>
					)}
				</p>
			</div>
		</form>
	);
}
