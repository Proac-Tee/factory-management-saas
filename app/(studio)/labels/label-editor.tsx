"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Field } from "@/components/field";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	EyeIcon,
	EyeOffIcon,
	MinusIcon,
	PlusIcon,
	PrinterIcon,
	TrashIcon,
} from "@/components/icons";
import { LabelRender } from "@/components/label-render";
import { ErrorLine, labelClass, outlineButton, PageHeader, panelFieldClass, primaryButton, SavedLine } from "@/components/ui";
import type { LabelFull } from "@/data-access/labels";
import { BARCODE_KIND_NAMES, checkGtin } from "@/entities/gtin";
import {
	checkFit,
	FIELDS,
	fillText,
	KIND_NAMES,
	LABEL_KINDS,
	type LabelDesign,
	type LabelDetailsInput,
	type LabelPart,
	LIMITS,
	MM_PER_PT,
	SIZE_PRESETS,
	type TextPart,
	usableWidthMm,
} from "@/entities/label";
import { archiveLabelAction, saveLabelAction } from "./actions";

type Props = {
	label: LabelFull | null;
	design: LabelDesign;
	customers: string[];
	canEdit: boolean;
	justSaved: boolean;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, round1(n)));
const partName = (part: LabelPart) =>
	part.kind === "logo" ? "Logo" : part.kind === "barcode" ? "Barcode" : part.text.trim() || "Empty line";

/**
 * Edit a label's size, parts and details with a to-scale preview
 * (Paper: "Desktop – Label editor"). Operators see it read-only.
 */
export function LabelEditor({ label, design: initialDesign, customers, canEdit, justSaved }: Props) {
	const [design, setDesign] = useState<LabelDesign>(initialDesign);
	const [details, setDetails] = useState<LabelDetailsInput>({
		name: label?.name ?? "",
		customer: label?.customer ?? "",
		kind: label?.kind ?? "srp",
		sku: label?.sku ?? "",
		storage: label?.storage ?? "",
		barcode: label?.barcode ?? "",
	});
	const [tab, setTab] = useState<"parts" | "details">("parts");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [dirty, setDirty] = useState(false);
	const [result, setResult] = useState<{ error?: string; field?: string; saved?: boolean }>(justSaved ? { saved: true } : {});
	const [saving, startSaving] = useTransition();

	// Warn before leaving with unsaved changes.
	useEffect(() => {
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	const change = (next: LabelDesign) => {
		setDesign(next);
		setDirty(true);
		setResult({});
	};
	const changeDetails = (field: keyof LabelDetailsInput, value: string) => {
		setDetails((d) => ({ ...d, [field]: value }));
		setDirty(true);
		setResult({});
	};
	const updatePart = (id: string, patch: Partial<LabelPart>) =>
		change({ ...design, parts: design.parts.map((p) => (p.id === id ? ({ ...p, ...patch } as LabelPart) : p)) });
	const movePart = (id: string, by: -1 | 1) => {
		const i = design.parts.findIndex((p) => p.id === id);
		const j = i + by;
		if (j < 0 || j >= design.parts.length) return;
		const parts = [...design.parts];
		[parts[i], parts[j]] = [parts[j], parts[i]];
		change({ ...design, parts });
	};
	const removePart = (id: string) => {
		change({ ...design, parts: design.parts.filter((p) => p.id !== id) });
		if (selectedId === id) setSelectedId(null);
	};
	const addPart = (kind: LabelPart["kind"]) => {
		const id = `p${Date.now().toString(36)}`;
		const part: LabelPart =
			kind === "text"
				? { id, kind, text: "NEW LINE", sizePt: 14, weight: 700, align: "center", visible: true }
				: kind === "logo"
					? { id, kind, heightMm: 12, visible: true }
					: { id, kind, heightMm: 24, numberSizePt: 11, visible: true };
		change({ ...design, parts: [...design.parts, part] });
		setSelectedId(id);
	};

	const fit = checkFit(design);
	const tooWide = useTooWide(design);
	const gtin = details.barcode.trim() ? checkGtin(details.barcode) : null;
	const previewBarcode = gtin?.ok ? gtin.gtin : null;

	const save = () =>
		startSaving(async () => {
			const saved = await saveLabelAction({ id: label?.id ?? null, details, design });
			if (saved.ok) {
				setDirty(false);
				setResult({ saved: true });
			} else {
				setResult({ error: saved.message, field: saved.field });
				if (saved.field && saved.field !== "design") setTab("details");
			}
		});

	const title = label ? label.name : "New label";
	const context = label ? `${label.customer}, ${KIND_NAMES[label.kind]} label` : "Labels";

	return (
		<div className="flex flex-1 flex-col">
			<PageHeader context={context} title={title} sticky>
				<div className="flex flex-wrap gap-3">
					{label && (
						<Link href={`/labels/${label.id}/print`} className={`${outlineButton} flex-1 pointer-coarse:h-14 sm:flex-none`}>
							<PrinterIcon size={18} />
							{canEdit ? "Print test label" : "Print labels"}
						</Link>
					)}
					{canEdit && (
						<button type="button" onClick={save} disabled={saving} className={`${primaryButton} h-12 flex-1 pointer-coarse:h-14 sm:flex-none`}>
							{saving ? "Saving…" : label ? "Save label" : "Create label"}
						</button>
					)}
				</div>
			</PageHeader>

			<div className="flex flex-1 flex-col-reverse tablet:flex-row">
				<div className="flex w-full flex-col gap-5 px-4 py-6 md:px-10 tablet:w-[512px] tablet:shrink-0">
					{!canEdit && (
						<p className="rounded-md border-2 border-graphite px-4 py-3 text-base leading-[22px]">
							You can print and scan this label. To change it, ask an editor or admin.
						</p>
					)}
					{result.error && <ErrorLine message={result.error} />}
					{result.saved && !dirty && <SavedLine>{justSaved && !label ? "Label created" : "Label saved"}</SavedLine>}
					{label?.archived && <ErrorLine message="This label is archived, so it's hidden from the library." />}

					<div role="tablist" aria-label="Edit" className="flex gap-1 rounded-md bg-wash p-1">
						{(
							[
								["parts", "Size and parts"],
								["details", "Details"],
							] as const
						).map(([key, name]) => (
							<button
								key={key}
								type="button"
								role="tab"
								aria-selected={tab === key}
								onClick={() => setTab(key)}
								className={`flex h-11 flex-1 items-center justify-center rounded-[6px] text-base pointer-coarse:h-12 ${
									tab === key ? "bg-ink font-bold text-stock" : "font-medium hover:bg-rule"
								}`}
							>
								{name}
							</button>
						))}
					</div>

					{tab === "parts" ? (
						<fieldset disabled={!canEdit} className="flex flex-col gap-5">
							<legend className="sr-only">Size and parts</legend>
							<SizeControls design={design} onChange={change} />

							<div className="flex flex-col border-t border-ink">
								{design.parts.length === 0 && (
									<p className="py-6 text-base text-graphite">No parts yet. Add a line of text, the logo or the barcode.</p>
								)}
								{design.parts.map((part, index) => (
									<PartRow
										key={part.id}
										part={part}
										selected={part.id === selectedId}
										first={index === 0}
										last={index === design.parts.length - 1}
										tooWide={tooWide.has(part.id)}
										onSelect={() => setSelectedId(part.id === selectedId ? null : part.id)}
										onChange={(patch) => updatePart(part.id, patch)}
										onMove={(by) => movePart(part.id, by)}
										onRemove={() => removePart(part.id)}
									/>
								))}
							</div>

							{canEdit && (
								<div className="flex flex-wrap gap-2">
									<button type="button" onClick={() => addPart("text")} className={outlineButton}>
										<PlusIcon size={18} />
										Add a line
									</button>
									{!design.parts.some((p) => p.kind === "logo") && (
										<button type="button" onClick={() => addPart("logo")} className={outlineButton}>
											<PlusIcon size={18} />
											Logo
										</button>
									)}
									{!design.parts.some((p) => p.kind === "barcode") && (
										<button type="button" onClick={() => addPart("barcode")} className={outlineButton}>
											<PlusIcon size={18} />
											Barcode
										</button>
									)}
								</div>
							)}

							<FitMeter fit={fit} heightMm={design.heightMm} tooWide={tooWide.size} />
							<p className="text-sm leading-5 text-graphite">
								Type {FIELDS.map((f) => `{${f.key}}`).join(", ")} in a line to fill it in when printing, like BATCH: {"{batch}"}.
							</p>
						</fieldset>
					) : (
						<DetailsForm
							details={details}
							customers={customers}
							canEdit={canEdit}
							error={result.field && result.field !== "design" ? result : undefined}
							onChange={changeDetails}
							gtin={gtin}
							label={label}
						/>
					)}
				</div>

				<Preview design={design} barcode={previewBarcode} selectedId={selectedId} canEdit={canEdit} />
			</div>
		</div>
	);
}

// ─── Size ────────────────────────────────────────────────────────────────────

function SizeControls({ design, onChange }: { design: LabelDesign; onChange: (d: LabelDesign) => void }) {
	const preset = SIZE_PRESETS.find((p) => p.widthMm === Math.round(design.widthMm) && p.heightMm === Math.round(design.heightMm));
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-base leading-5 font-bold">Label size</span>
				<div className="flex gap-1.5" role="group" aria-label="Common sizes">
					{SIZE_PRESETS.map((p) => {
						const on = preset === p;
						return (
							<button
								key={`${p.widthMm}x${p.heightMm}`}
								type="button"
								aria-pressed={on}
								onClick={() => onChange({ ...design, widthMm: p.widthMm, heightMm: p.heightMm, marginMm: p.heightMm < 40 ? 1.5 : design.marginMm })}
								className={`flex h-9 items-center rounded-[6px] px-2.5 text-sm font-bold tabular-nums pointer-coarse:h-12 ${
									on ? "bg-ink text-stock" : "border border-rule hover:border-ink"
								}`}
							>
								{p.widthMm} × {p.heightMm}
							</button>
						);
					})}
				</div>
			</div>
			<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
				<NumberBox label="Width" unit="mm" value={design.widthMm} limits={LIMITS.sizeMm} onChange={(widthMm) => onChange({ ...design, widthMm })} />
				<NumberBox label="Height" unit="mm" value={design.heightMm} limits={LIMITS.sizeMm} onChange={(heightMm) => onChange({ ...design, heightMm })} />
				<NumberBox label="Margin" unit="mm" value={design.marginMm} limits={LIMITS.marginMm} onChange={(marginMm) => onChange({ ...design, marginMm })} />
				<NumberBox label="Gap" unit="mm" value={design.gapMm} limits={LIMITS.gapMm} onChange={(gapMm) => onChange({ ...design, gapMm })} />
			</div>
		</div>
	);
}

/** A number field that keeps what's typed until it's a valid number. */
function NumberBox({
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
	const number = Number(text.replace(",", "."));
	const invalid = text.trim() === "" || !Number.isFinite(number) || number < limits.min || number > limits.max;
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
						const n = Number(e.target.value.replace(",", "."));
						if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= limits.min && n <= limits.max) onChange(round1(n));
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

// ─── Parts ───────────────────────────────────────────────────────────────────

function Stepper({
	value,
	unit,
	step,
	limits,
	label,
	onChange,
}: {
	value: number;
	unit: "pt" | "mm";
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

function PartRow({
	part,
	selected,
	first,
	last,
	tooWide,
	onSelect,
	onChange,
	onMove,
	onRemove,
}: {
	part: LabelPart;
	selected: boolean;
	first: boolean;
	last: boolean;
	tooWide: boolean;
	onSelect: () => void;
	onChange: (patch: Partial<LabelPart>) => void;
	onMove: (by: -1 | 1) => void;
	onRemove: () => void;
}) {
	const name = partName(part);
	return (
		<div className={`flex flex-col border-b border-rule ${selected ? "-mx-3 my-1 rounded-md border-2 border-ink px-2.5" : ""}`}>
			<div className="flex min-h-14 items-center gap-2">
				<button
					type="button"
					aria-pressed={part.visible}
					aria-label={part.visible ? `Hide ${name}` : `Show ${name}`}
					onClick={() => onChange({ visible: !part.visible })}
					className="flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-wash pointer-coarse:size-12"
				>
					{part.visible ? <EyeIcon size={20} /> : <EyeOffIcon size={20} className="text-graphite" />}
				</button>
				<button
					type="button"
					onClick={onSelect}
					aria-expanded={selected}
					className={`flex min-h-12 min-w-0 flex-1 flex-col justify-center text-left ${part.visible ? "" : "text-graphite"}`}
				>
					<span className={`truncate text-base leading-5 ${selected ? "font-bold" : "font-medium"}`}>{name}</span>
					{tooWide && <span className="text-sm leading-[18px] font-bold text-hold">Too wide for the label</span>}
				</button>
				{part.kind === "text" ? (
					<Stepper label="Text size" unit="pt" step={0.5} value={part.sizePt} limits={LIMITS.textPt} onChange={(sizePt) => onChange({ sizePt })} />
				) : (
					<Stepper
						label={part.kind === "logo" ? "Logo height" : "Barcode height"}
						unit="mm"
						step={1}
						value={part.heightMm}
						limits={LIMITS.blockMm}
						onChange={(heightMm) => onChange({ heightMm })}
					/>
				)}
			</div>

			{selected && (
				<div className="flex flex-col gap-4 pt-1 pb-4 pl-12 pointer-coarse:pl-14">
					{part.kind === "text" && <TextOptions part={part} onChange={onChange} />}
					{part.kind === "barcode" && (
						<div className="flex items-center justify-between gap-3">
							<span className="text-[15px]">Number under the bars</span>
							<Stepper
								label="Number size"
								unit="pt"
								step={0.5}
								value={part.numberSizePt}
								limits={LIMITS.numberPt}
								onChange={(numberSizePt) => onChange({ numberSizePt })}
							/>
						</div>
					)}
					<div className="flex flex-wrap gap-2">
						<button type="button" disabled={first} onClick={() => onMove(-1)} className={`${outlineButton} h-11 px-3.5`}>
							<ArrowUpIcon size={18} />
							Move up
						</button>
						<button type="button" disabled={last} onClick={() => onMove(1)} className={`${outlineButton} h-11 px-3.5`}>
							<ArrowDownIcon size={18} />
							Move down
						</button>
						<button
							type="button"
							onClick={onRemove}
							className="inline-flex h-11 items-center gap-2 rounded-md px-3.5 text-base font-bold text-hold underline underline-offset-2"
						>
							<TrashIcon size={18} />
							Remove
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function TextOptions({ part, onChange }: { part: TextPart; onChange: (patch: Partial<TextPart>) => void }) {
	const id = useId();
	return (
		<>
			<div className="flex flex-col gap-1.5">
				<label htmlFor={id} className={labelClass}>
					Text
				</label>
				<input
					id={id}
					value={part.text}
					maxLength={LIMITS.textLength}
					onChange={(e) => onChange({ text: e.target.value })}
					className={`${panelFieldClass.replace("bg-stock", "bg-wash")} font-bold`}
				/>
			</div>
			<Choice
				label="Weight"
				value={String(part.weight)}
				options={[
					["400", "Regular"],
					["700", "Bold"],
					["900", "Black"],
				]}
				onChange={(v) => onChange({ weight: Number(v) as TextPart["weight"] })}
			/>
			<Choice
				label="Align"
				value={part.align}
				options={[
					["left", "Left"],
					["center", "Centre"],
					["right", "Right"],
				]}
				onChange={(v) => onChange({ align: v as TextPart["align"] })}
			/>
		</>
	);
}

function Choice({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: [string, string][];
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span className="text-[15px]">{label}</span>
			<div role="radiogroup" aria-label={label} className="flex gap-1 rounded-md bg-wash p-1">
				{options.map(([v, name]) => (
					<button
						key={v}
						type="button"
						role="radio"
						aria-checked={value === v}
						onClick={() => onChange(v)}
						className={`h-9 rounded-[6px] px-3 text-sm pointer-coarse:h-11 ${value === v ? "bg-ink font-bold text-stock" : "font-medium hover:bg-rule"}`}
					>
						{name}
					</button>
				))}
			</div>
		</div>
	);
}

function FitMeter({ fit, heightMm, tooWide }: { fit: ReturnType<typeof checkFit>; heightMm: number; tooWide: number }) {
	const used = Math.min(100, (fit.usedMm / heightMm) * 100);
	return (
		<div className="flex flex-col gap-2 border-t border-ink pt-4">
			<div className="flex items-baseline justify-between">
				<span className="text-base leading-5 font-bold">Space used on the label</span>
				<span className="text-base leading-5 font-black tabular-nums">
					{fit.usedMm} of {heightMm} mm
				</span>
			</div>
			<div className="h-2 overflow-hidden rounded-[2px] bg-wash" aria-hidden="true">
				<div className={`h-full ${fit.fits ? "bg-ink" : "bg-hold"}`} style={{ width: `${used}%` }} />
			</div>
			{!fit.fits ? (
				<ErrorLine message={`Doesn't fit: ${Math.abs(fit.spareMm)} mm too tall. Make some parts smaller or hide one.`} />
			) : tooWide > 0 ? (
				<ErrorLine message={`${tooWide === 1 ? "One line is" : `${tooWide} lines are`} too wide. Make ${tooWide === 1 ? "it" : "them"} smaller or shorter.`} />
			) : (
				<SavedLine>Fits, with {fit.spareMm} mm to spare.</SavedLine>
			)}
		</div>
	);
}

// ─── Details ─────────────────────────────────────────────────────────────────

function DetailsForm({
	details,
	customers,
	canEdit,
	error,
	onChange,
	gtin,
	label,
}: {
	details: LabelDetailsInput;
	customers: string[];
	canEdit: boolean;
	error?: { error?: string; field?: string };
	onChange: (field: keyof LabelDetailsInput, value: string) => void;
	gtin: ReturnType<typeof checkGtin> | null;
	label: LabelFull | null;
}) {
	const listId = useId();
	const errorFor = (field: string) => (error?.field === field ? error.error : undefined);
	const [archiving, startArchiving] = useTransition();
	const [confirmArchive, setConfirmArchive] = useState(false);
	return (
		<fieldset disabled={!canEdit} className="flex flex-col gap-5">
			<legend className="sr-only">Details</legend>
			<Field label="Name in the library" value={details.name} maxLength={80} onChange={(e) => onChange("name", e.target.value)} error={errorFor("name")} />
			<Field
				label="Customer"
				list={listId}
				value={details.customer}
				maxLength={40}
				onChange={(e) => onChange("customer", e.target.value)}
				error={errorFor("customer")}
				hint="Labels group by this. Use Ember for our own labels."
			/>
			<datalist id={listId}>
				{customers.map((c) => (
					<option key={c} value={c} />
				))}
			</datalist>

			<div className="flex flex-col gap-1.5">
				<span className={labelClass}>Type</span>
				<div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
					{LABEL_KINDS.map((k) => (
						<button
							key={k}
							type="button"
							role="radio"
							aria-checked={details.kind === k}
							onClick={() => onChange("kind", k)}
							className={`h-10 rounded-md px-3.5 text-[15px] pointer-coarse:h-12 ${
								details.kind === k ? "bg-ink font-bold text-stock" : "border border-rule font-medium hover:border-ink"
							}`}
						>
							{KIND_NAMES[k]}
						</button>
					))}
				</div>
				{errorFor("kind") && <ErrorLine message={errorFor("kind")!} />}
			</div>

			<div className="grid grid-cols-2 gap-3">
				<Field label="SKU (optional)" value={details.sku} maxLength={20} onChange={(e) => onChange("sku", e.target.value.toUpperCase())} error={errorFor("sku")} className={`${panelFieldClass.replace("bg-stock", "bg-wash")} uppercase tabular-nums`} />
				<div className="flex flex-col gap-1.5">
					<span className={labelClass}>Storage</span>
					<div role="radiogroup" aria-label="Storage" className="flex h-tap gap-1 rounded-md bg-wash p-1">
						{(
							[
								["ambient", "Ambient"],
								["chilled", "Chilled"],
								["", "None"],
							] as const
						).map(([v, name]) => (
							<button
								key={name}
								type="button"
								role="radio"
								aria-checked={details.storage === v}
								onClick={() => onChange("storage", v)}
								className={`flex-1 rounded-[6px] text-[15px] ${details.storage === v ? "bg-ink font-bold text-stock" : "font-medium hover:bg-rule"}`}
							>
								{name}
							</button>
						))}
					</div>
				</div>
			</div>

			<Field
				label="Barcode number (case ITF-14 or pouch EAN-13)"
				inputMode="numeric"
				value={details.barcode}
				onChange={(e) => onChange("barcode", e.target.value)}
				error={errorFor("barcode") ?? (gtin && !gtin.ok ? gtin.message : undefined)}
				hint={gtin?.ok ? `${BARCODE_KIND_NAMES[gtin.kind]}. Scanning it finds this label.` : "From your GS1 account. Leave empty for labels with no barcode."}
				className={`${panelFieldClass.replace("bg-stock", "bg-wash")} tabular-nums`}
			/>

			{label && canEdit && (
				<div className="flex flex-col gap-2 border-t border-rule pt-4">
					{confirmArchive ? (
						<div className="flex flex-col gap-3 rounded-md border-2 border-hold p-4">
							<p className="text-[15px] leading-5">
								{label.archived ? "Put this label back in the library?" : "Archive this label? It leaves the library but its checks and history stay."}
							</p>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={archiving}
									onClick={() => startArchiving(async () => void (await archiveLabelAction(label.id, !label.archived)))}
									className={`h-12 flex-1 rounded-md px-3 font-bold text-stock ${label.archived ? "bg-ink" : "bg-hold"}`}
								>
									{archiving ? "Saving…" : label.archived ? "Restore" : "Archive"}
								</button>
								<button type="button" onClick={() => setConfirmArchive(false)} className="h-12 flex-1 rounded-md border border-ink font-bold">
									Keep as it is
								</button>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setConfirmArchive(true)}
							className={`h-12 w-fit text-base font-bold underline underline-offset-2 ${label.archived ? "" : "text-hold"}`}
						>
							{label.archived ? "Restore this label" : "Archive this label"}
						</button>
					)}
					{label.updatedByName && (
						<p className="text-sm leading-5 text-graphite tabular-nums">
							Last changed by {label.updatedByName}, {new Date(label.updatedAt).toLocaleDateString("en-GB", { timeZone: "Europe/London" }).replaceAll("/", ".")}
						</p>
					)}
				</div>
			)}
		</fieldset>
	);
}

// ─── Preview ─────────────────────────────────────────────────────────────────

function Preview({
	design,
	barcode,
	selectedId,
	canEdit,
}: { design: LabelDesign; barcode: string | null; selectedId: string | null; canEdit: boolean }) {
	const [box, setBox] = useState({ width: 0, height: 0 });
	const measure = useCallback((node: HTMLDivElement | null) => {
		if (!node) return;
		const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	const scale = box.width > 0 ? Math.min(box.width / design.widthMm, Math.max(box.height, 280) / design.heightMm, 7) : 0;
	const values = Object.fromEntries(FIELDS.map((f) => [f.key, f.example]));

	return (
		<section
			aria-label="Preview"
			className="flex flex-col items-center gap-4 border-b border-rule bg-wash px-4 py-6 md:px-10 tablet:sticky tablet:top-[121px] tablet:h-[calc(100dvh-121px)] tablet:flex-1 tablet:border-b-0 tablet:border-l tablet:py-10"
		>
			<div ref={measure} className="flex w-full max-w-[640px] flex-1 items-center justify-center tablet:min-h-0">
				{scale > 0 && (
					<div className="border border-graphite">
						<LabelRender design={design} barcode={barcode} values={values} scale={scale} selectedId={selectedId} />
					</div>
				)}
			</div>
			<p className="text-center text-sm leading-5 text-graphite tabular-nums">
				To scale, {design.widthMm} × {design.heightMm} mm.{canEdit && " The outlined part is the one you're editing."} Batch and BBE show sample values.
			</p>
		</section>
	);
}

// ─── Width check ─────────────────────────────────────────────────────────────

const noSubscribe = () => () => {};

/** Lines wider than the label, measured with the label's own font. */
function useTooWide(design: LabelDesign): Set<string> {
	// The page font (next/font gives it a generated name); none on the server.
	const font = useSyncExternalStore(
		noSubscribe,
		() => getComputedStyle(document.body).fontFamily,
		() => null,
	);
	return useMemo(() => {
		const wide = new Set<string>();
		if (!font || typeof document === "undefined") return wide;
		const ctx = document.createElement("canvas").getContext("2d");
		if (!ctx) return wide;
		const usable = usableWidthMm(design);
		const values = Object.fromEntries(FIELDS.map((f) => [f.key, f.example]));
		for (const part of design.parts) {
			if (part.kind !== "text" || !part.visible) continue;
			ctx.font = `${part.weight} 100px ${font}`;
			const widthMm = (ctx.measureText(fillText(part.text, values)).width / 100) * part.sizePt * MM_PER_PT;
			if (widthMm > usable) wide.add(part.id);
		}
		return wide;
	}, [design, font]);
}
