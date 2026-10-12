"use client";

import { NumberBox, Segmented, Stepper } from "@/components/controls";
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { button, ErrorLine, labelClass, panelFieldClass, SavedLine } from "@/components/ui";
import { type Fit, FIELDS, type LabelPart, LIMITS, SIZE_PRESETS, type StackDesign, type TextPart } from "@/entities/label";
import { canAdd, matchingPreset } from "@/entities/label-edit";
import type { LabelEditorState } from "./use-label-editor";

const partName = (part: LabelPart) =>
	part.kind === "logo" ? "Logo" : part.kind === "barcode" ? "Barcode" : part.text.trim() || "Empty line";

/** A stacked label's size, its parts top to bottom, and whether they fit. */
export function PartsPanel({ editor, design, canEdit }: { editor: LabelEditorState; design: StackDesign; canEdit: boolean }) {
	const { parts, selectedId, tooWide } = editor;
	return (
		<fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-5">
			<legend className="sr-only">Size and parts</legend>
			<SizeControls editor={editor} design={design} />

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
						onSelect={() => parts.toggle(part.id)}
						onChange={(patch) => parts.update(part.id, patch)}
						onMove={(by) => parts.move(part.id, by)}
						onRemove={() => parts.remove(part.id)}
					/>
				))}
			</div>

			{canEdit && (
				<div className="flex flex-wrap gap-2">
					{(
						[
							["text", "Add a line"],
							["logo", "Logo"],
							["barcode", "Barcode"],
						] as const
					)
						.filter(([kind]) => canAdd(design, kind))
						.map(([kind, name]) => (
							<button key={kind} type="button" onClick={() => parts.add(kind)} className={button({ variant: "outline", size: "md" })}>
								<PlusIcon size={18} />
								{name}
							</button>
						))}
				</div>
			)}

			{editor.fieldError?.field === "design" && <ErrorLine message={editor.fieldError.message} />}
			{editor.fit && <FitMeter fit={editor.fit} heightMm={design.heightMm} tooWide={tooWide.size} />}
			<p className="text-sm leading-5 text-graphite">
				Type {FIELDS.map((f) => `{${f.key}}`).join(", ")} in a line to fill it in when printing, like BATCH: {"{batch}"}.
			</p>
		</fieldset>
	);
}

function SizeControls({ editor, design }: { editor: LabelEditorState; design: StackDesign }) {
	const { size } = editor;
	const preset = matchingPreset(design, SIZE_PRESETS);
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-base leading-5 font-bold">Label size</span>
				<div className="flex flex-wrap gap-1.5" role="group" aria-label="Common sizes">
					{SIZE_PRESETS.map((p) => (
						<button
							key={`${p.widthMm}x${p.heightMm}`}
							type="button"
							aria-pressed={preset === p}
							onClick={() => size.preset(p)}
							className={`flex h-9 items-center rounded-[6px] px-2.5 text-sm font-bold tabular-nums pointer-coarse:h-12 ${
								preset === p ? "bg-ink text-stock" : "border border-rule hover:border-ink"
							}`}
						>
							{p.widthMm} × {p.heightMm}
						</button>
					))}
				</div>
			</div>
			<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
				<NumberBox label="Width" unit="mm" value={design.widthMm} limits={LIMITS.sizeMm} onChange={(widthMm) => size.change({ ...design, widthMm })} />
				<NumberBox label="Height" unit="mm" value={design.heightMm} limits={LIMITS.sizeMm} onChange={(heightMm) => size.change({ ...design, heightMm })} />
				<NumberBox label="Margin" unit="mm" value={design.marginMm} limits={LIMITS.marginMm} onChange={(marginMm) => size.change({ ...design, marginMm })} />
				<NumberBox label="Gap" unit="mm" value={design.gapMm} limits={LIMITS.gapMm} onChange={(gapMm) => size.change({ ...design, gapMm })} />
			</div>
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
						<button type="button" disabled={first} onClick={() => onMove(-1)} className={button({ variant: "outline", size: "sm" })}>
							<ArrowUpIcon size={18} />
							Move up
						</button>
						<button type="button" disabled={last} onClick={() => onMove(1)} className={button({ variant: "outline", size: "sm" })}>
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

const WEIGHTS = [
	["400", "Regular"],
	["700", "Bold"],
	["900", "Black"],
] as const;
const ALIGNS = [
	["left", "Left"],
	["center", "Centre"],
	["right", "Right"],
] as const;

function TextOptions({ part, onChange }: { part: TextPart; onChange: (patch: Partial<TextPart>) => void }) {
	return (
		<>
			<label className="flex flex-col gap-1.5">
				<span className={labelClass}>Text</span>
				<input
					value={part.text}
					maxLength={LIMITS.textLength}
					onChange={(e) => onChange({ text: e.target.value })}
					className={`${panelFieldClass.replace("bg-stock", "bg-wash")} font-bold`}
				/>
			</label>
			<Segmented
				label="Weight"
				size="sm"
				value={String(part.weight) as (typeof WEIGHTS)[number][0]}
				options={WEIGHTS}
				onChange={(v) => onChange({ weight: Number(v) as TextPart["weight"] })}
			/>
			<Segmented label="Align" size="sm" value={part.align} options={ALIGNS} onChange={(align) => onChange({ align })} />
		</>
	);
}

function FitMeter({ fit, heightMm, tooWide }: { fit: Fit; heightMm: number; tooWide: number }) {
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
				<div
					className={`h-full w-full origin-left transition-[scale,background-color] duration-300 ease-out-expo motion-reduce:transition-[background-color] ${fit.fits ? "bg-ink" : "bg-hold"}`}
					style={{ scale: `${used / 100} 1` }}
				/>
			</div>
			{!fit.fits ? (
				<ErrorLine message={`Doesn't fit: ${Math.abs(fit.spareMm)} mm too tall. Make some parts smaller or hide one.`} />
			) : tooWide > 0 ? (
				<ErrorLine
					message={`${tooWide === 1 ? "One line is" : `${tooWide} lines are`} too wide. Make ${tooWide === 1 ? "it" : "them"} smaller or shorter.`}
				/>
			) : (
				<SavedLine>Fits, with {fit.spareMm} mm to spare.</SavedLine>
			)}
		</div>
	);
}
