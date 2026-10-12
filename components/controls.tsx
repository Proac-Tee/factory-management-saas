"use client";

// Form controls in the Ember look, shared by the editor, print and access
// screens. Each one is a plain, accessible element with no app logic.

import { useId, useState } from "react";
import { MinusIcon, PlusIcon } from "./icons";
import { labelClass } from "./ui";

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, round1(n)));

/**
 * One choice from a few, as a row of buttons (a radio group). The chosen one
 * is ink-filled. `size` matches the surrounding controls.
 */
export function Segmented<T extends string>({
	label,
	value,
	options,
	onChange,
	size = "md",
	hideLabel = false,
	className = "",
}: {
	label: string;
	value: T;
	options: readonly (readonly [T, string])[];
	onChange: (value: T) => void;
	size?: "sm" | "md";
	hideLabel?: boolean;
	className?: string;
}) {
	const height = size === "sm" ? "h-9 pointer-coarse:h-11" : "h-11 pointer-coarse:h-12";
	return (
		<div className={`flex items-center justify-between gap-3 ${className}`}>
			{!hideLabel && <span className="text-[15px]">{label}</span>}
			<div role="radiogroup" aria-label={label} className={`flex gap-1 rounded-md bg-wash p-1 ${hideLabel ? "flex-1" : ""}`}>
				{options.map(([v, name]) => (
					<button
						key={v}
						type="button"
						role="radio"
						aria-checked={value === v}
						onClick={() => onChange(v)}
						className={`${height} flex-1 rounded-[6px] px-3 text-sm ${
							value === v ? "bg-ink font-bold text-stock" : "font-medium hover:bg-rule"
						}`}
					>
						{name}
					</button>
				))}
			</div>
		</div>
	);
}

/** Choose one of many, as wrapping chips (a radio group). */
export function Chips<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: readonly (readonly [T, string])[];
	onChange: (value: T) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className={labelClass}>{label}</span>
			<div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
				{options.map(([v, name]) => (
					<button
						key={v}
						type="button"
						role="radio"
						aria-checked={value === v}
						onClick={() => onChange(v)}
						className={`h-10 rounded-md px-3.5 text-[15px] pointer-coarse:h-12 ${
							value === v ? "bg-ink font-bold text-stock" : "border border-rule font-medium hover:border-ink"
						}`}
					>
						{name}
					</button>
				))}
			</div>
		</div>
	);
}

/** − value + buttons that step a number within limits. */
export function Stepper({
	value,
	unit,
	step,
	limits,
	label,
	onChange,
}: {
	value: number;
	unit: string;
	step: number;
	limits: { min: number; max: number };
	label: string;
	onChange: (n: number) => void;
}) {
	return (
		<div className="flex shrink-0 items-center rounded-md bg-wash" role="group" aria-label={label}>
			<button
				type="button"
				aria-label={`Smaller ${label.toLowerCase()}`}
				disabled={value <= limits.min}
				onClick={() => onChange(clamp(value - step, limits))}
				className="flex size-10 items-center justify-center rounded-l-md hover:bg-rule disabled:text-rule pointer-coarse:size-12"
			>
				<MinusIcon size={16} />
			</button>
			<output className="w-16 text-center text-[15px] font-bold tabular-nums" aria-live="polite">
				{value} {unit}
			</output>
			<button
				type="button"
				aria-label={`Bigger ${label.toLowerCase()}`}
				disabled={value >= limits.max}
				onClick={() => onChange(clamp(value + step, limits))}
				className="flex size-10 items-center justify-center rounded-r-md hover:bg-rule disabled:text-rule pointer-coarse:size-12"
			>
				<PlusIcon size={16} />
			</button>
		</div>
	);
}

/** A number field that keeps what's typed until it's a valid number in range. */
export function NumberBox({
	label,
	unit,
	value,
	limits,
	onChange,
}: {
	label: string;
	unit: string;
	value: number;
	limits: { min: number; max: number };
	onChange: (n: number) => void;
}) {
	const id = useId();
	const [text, setText] = useState(String(value));
	const [seen, setSeen] = useState(value);
	if (value !== seen) {
		setSeen(value);
		setText(String(value));
	}
	const parse = (s: string) => {
		const n = Number(s.replace(",", "."));
		return s.trim() !== "" && Number.isFinite(n) && n >= limits.min && n <= limits.max ? round1(n) : null;
	};
	const invalid = parse(text) === null;
	return (
		<div className="flex flex-col gap-1">
			<label htmlFor={id} className={labelClass}>
				{label}
			</label>
			<div className="relative">
				<input
					id={id}
					inputMode="decimal"
					value={text}
					aria-invalid={invalid}
					aria-describedby={invalid ? `${id}-range` : undefined}
					onChange={(e) => {
						setText(e.target.value);
						const n = parse(e.target.value);
						if (n !== null) onChange(n);
					}}
					onBlur={() => invalid && setText(String(value))}
					className="h-12 w-full rounded-t-md border-b-2 border-ink bg-wash pr-10 pl-3 text-lg font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ink aria-invalid:border-hold pointer-coarse:h-14"
				/>
				<span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-graphite">{unit}</span>
			</div>
			{invalid && (
				<span id={`${id}-range`} className="text-sm leading-[18px] font-bold text-hold tabular-nums">
					{limits.min} to {limits.max}
				</span>
			)}
		</div>
	);
}
