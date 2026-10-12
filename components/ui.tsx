// Shared pieces of the Ember look: fields with an ink underline on a wash
// fill, plain-words error lines, and the page header.

import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon } from "./icons";

/** A field on a white page. The underline on a rounded-top field is the Paper style. */
export const fieldClass =
	"h-tap w-full rounded-t-md border-b-2 border-ink bg-wash px-4 text-lg leading-[22px] outline-none placeholder:font-medium placeholder:text-graphite focus-visible:ring-2 focus-visible:ring-ink aria-invalid:border-hold";
/** A field inside a wash panel. */
export const panelFieldClass = fieldClass.replace("bg-wash", "bg-stock");
export const labelClass = "text-sm leading-[18px] font-medium text-graphite";

export const primaryButton =
	"inline-flex h-tap items-center justify-center gap-2 rounded-md bg-ink px-5 text-base font-bold text-stock disabled:bg-rule disabled:text-graphite";
export const outlineButton =
	"inline-flex h-12 items-center justify-center gap-2 rounded-md border border-ink bg-stock px-5 text-base font-bold disabled:border-rule disabled:text-graphite";

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
