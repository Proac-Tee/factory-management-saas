"use client";

import { type InputHTMLAttributes, type ReactNode, useId } from "react";
import { ErrorLine, fieldClass, labelClass } from "./ui";

export function Field({
	label,
	error,
	hint,
	className = fieldClass,
	...input
}: { label: string; error?: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
	const id = useId();
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className={labelClass}>
				{label}
			</label>
			<input
				id={id}
				aria-invalid={Boolean(error)}
				aria-describedby={error ? `${id}-error` : undefined}
				className={className}
				{...input}
			/>
			{error && <ErrorLine id={`${id}-error`} message={error} />}
			{!error && hint && <p className="text-sm leading-5 text-graphite">{hint}</p>}
		</div>
	);
}
