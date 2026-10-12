// Shared pieces of the Ember look: fields with an ink underline on a wash
// fill, plain-words error lines, and the page header.

import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon } from "./icons";

/** A field on a white page. The underline on a rounded-top field is the Paper style. */
export const fieldClass =
	"h-tap w-full rounded-t-md inset-shadow-[0_-2px_0_var(--color-ink)] bg-wash px-4 text-lg leading-[22px] outline-none placeholder:font-medium placeholder:text-graphite focus-visible:ring-2 focus-visible:ring-ink aria-invalid:inset-shadow-[0_-2px_0_var(--color-hold)]";
/** A field inside a wash panel. */
export const panelFieldClass = fieldClass.replace("bg-wash", "bg-stock");
export const labelClass = "text-sm leading-[18px] font-medium text-graphite";

const BUTTON_VARIANTS = {
	primary: "bg-ink text-stock hover:bg-graphite disabled:bg-rule disabled:text-graphite",
	outline: "border border-ink bg-stock hover:bg-wash disabled:border-rule disabled:text-graphite",
} as const;

/** Each size sets its height once; touch screens get the bigger target. */
const BUTTON_SIZES = {
	/** Inside a row of controls (move up/down). */
	sm: "h-11 px-3.5 text-base pointer-coarse:h-12",
	/** Page header actions, side by side. */
	md: "h-12 px-5 text-base pointer-coarse:h-14",
	/** The main action of a form. */
	lg: "h-tap px-5 text-base",
	/** The one action a screen exists for (print, sign in, next check). */
	xl: "h-[60px] px-6 text-lg",
} as const;

/** Classes for a button or a link that looks like one. Add layout (width, flex) around it, not size. */
export const button = ({
	variant = "primary",
	size = "lg",
}: { variant?: keyof typeof BUTTON_VARIANTS; size?: keyof typeof BUTTON_SIZES } = {}) =>
	`inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100 motion-reduce:active:scale-100 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}`;

export function ErrorLine({ message, id }: { message: string; id?: string }) {
	return (
		<p id={id} role="alert" className="flex gap-2 text-sm leading-5 font-bold text-hold">
			<AlertTriangleIcon size={18} className="mt-px shrink-0" />
			{message}
		</p>
	);
}

export function SavedLine({ children }: { children: ReactNode }) {
	return (
		<p role="status" className="flex items-center gap-2 text-sm leading-5 font-bold text-pass">
			<CheckIcon size={18} strokeWidth={2.5} className="shrink-0" />
			{children}
		</p>
	);
}

/** 44px title and actions over a 1px ink rule. */
export function PageHeader({
	context,
	title,
	sticky = false,
	children,
}: { context?: ReactNode; title: string; sticky?: boolean; children?: ReactNode }) {
	return (
		<header
			className={`flex flex-col gap-4 border-b border-ink bg-stock px-4 pt-5 pb-4 md:flex-row md:items-end md:justify-between md:px-10 md:pt-7 md:pb-5 ${
				sticky ? "no-print z-20 md:sticky md:top-0" : ""
			}`}
		>
			<div className="flex min-w-0 flex-col gap-1.5">
				{context && <div className="text-sm leading-[18px] text-graphite tabular-nums">{context}</div>}
				<h1 className="text-xl leading-8 font-black tracking-tight md:text-2xl md:leading-12">{title}</h1>
			</div>
			{children}
		</header>
	);
}
