"use client";

import { NumberBox, Segmented, Stepper } from "@/components/controls";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { button, ErrorLine, labelClass, panelFieldClass } from "@/components/ui";
import { FIELDS } from "@/entities/label";
import { type PlacedDesign, type PlacedPart, type PlacedText, PLACED_LIMITS, partsOutside } from "@/entities/placed";
import { placedPartName, setParagraphText, setTextSize, textSizeOf } from "@/entities/placed-edit";
import type { LabelEditorState } from "./use-label-editor";

const ALIGNS = [
	["left", "Left"],
	["center", "Centre"],
	["right", "Right"],
] as const;

/**
 * An imported label, laid out as drawn: its parts in the order they're
 * drawn, each with its own position and size. Drawn shapes (bars, borders)
 * are one row, as nobody edits them one by one.
 */
export function PlacedPanel({ editor, design, canEdit }: { editor: LabelEditorState; design: PlacedDesign; canEdit: boolean }) {
	const { selectedId, parts, placed } = editor;
	const listed = design.parts.filter((p) => p.kind !== "shape");
	const shapes = design.parts.filter((p) => p.kind === "shape");
	const shapesShown = shapes.some((p) => p.visible);
	const outside = partsOutside(design);

	return (
		<fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-5">
			<legend className="sr-only">Parts</legend>
			<div className="grid grid-cols-2 gap-2.5">
				<NumberBox label="Label width" unit="mm" value={design.widthMm} limits={{ min: 10, max: 300 }} onChange={(widthMm) => editor.size.change({ ...design, widthMm })} />
				<NumberBox label="Label height" unit="mm" value={design.heightMm} limits={{ min: 10, max: 300 }} onChange={(heightMm) => editor.size.change({ ...design, heightMm })} />
			</div>

			<div className="flex flex-col border-t border-ink">
				{listed.map((part) => (
					<PartRow
						key={part.id}
						part={part}
						selected={part.id === selectedId}
						outside={outside.includes(part.id)}
						onSelect={() => parts.toggle(part.id)}
						onToggle={() => placed.update(part.id, { visible: !part.visible })}
					>
						{part.id === selectedId && <PartEditor part={part} editor={editor} />}
					</PartRow>
				))}
				{shapes.length > 0 && (
					<div className="flex min-h-14 items-center gap-2 border-b border-rule">
						<VisibilityButton
							visible={shapesShown}
							name="drawn shapes"
							onClick={() => {
								let next = design;
								for (const shape of shapes) next = { ...next, parts: next.parts.map((p) => (p.id === shape.id ? { ...p, visible: !shapesShown } : p)) };
								editor.size.change(next);
							}}
						/>
						<span className={`text-base leading-5 font-medium ${shapesShown ? "" : "text-graphite"}`}>
							{shapes.length} drawn {shapes.length === 1 ? "shape" : "shapes"} (bars, borders)
						</span>
					</div>
				)}
			</div>

			{canEdit && (
				<button type="button" onClick={placed.addText} className={`${button({ variant: "outline", size: "md" })} w-fit`}>
					<PlusIcon size={18} />
					Add a text box
				</button>
			)}
			{outside.length > 0 && (
				<ErrorLine message={`${outside.length === 1 ? "One part reaches" : `${outside.length} parts reach`} past the edge of the label.`} />
			)}
			<p className="text-sm leading-5 text-graphite">
				Laid out as in the original file. Type {FIELDS.map((f) => `{${f.key}}`).join(", ")} in a line to fill it in when printing.
			</p>
		</fieldset>
	);
}

function VisibilityButton({ visible, name, onClick }: { visible: boolean; name: string; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-pressed={visible}
			aria-label={visible ? `Hide ${name}` : `Show ${name}`}
			onClick={onClick}
			className="flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-wash pointer-coarse:size-12"
		>
			{visible ? <EyeIcon size={20} /> : <EyeOffIcon size={20} className="text-graphite" />}
		</button>
	);
}

function PartRow({
	part,
	selected,
	outside,
	onSelect,
	onToggle,
	children,
}: {
	part: PlacedPart;
	selected: boolean;
	outside: boolean;
	onSelect: () => void;
	onToggle: () => void;
	children?: React.ReactNode;
}) {
	const name = placedPartName(part);
	return (
		<div className={`flex flex-col border-b border-rule ${selected ? "-mx-3 my-1 rounded-md border-2 border-ink px-2.5" : ""}`}>
			<div className="flex min-h-14 items-center gap-2">
				<VisibilityButton visible={part.visible} name={name} onClick={onToggle} />
				<button
					type="button"
					onClick={onSelect}
					aria-expanded={selected}
					className={`flex min-h-12 min-w-0 flex-1 flex-col justify-center text-left ${part.visible ? "" : "text-graphite"}`}
				>
					<span className={`truncate text-base leading-5 ${selected ? "font-bold" : "font-medium"}`}>{name}</span>
					{outside && <span className="text-sm leading-[18px] font-bold text-hold">Past the edge of the label</span>}
				</button>
				{part.kind === "text" && <span className="shrink-0 text-sm font-bold tabular-nums">{textSizeOf(part)} pt</span>}
			</div>
			{children}
		</div>
	);
}

function PartEditor({ part, editor }: { part: PlacedPart; editor: LabelEditorState }) {
	const { placed } = editor;
	return (
		<div className="flex flex-col gap-4 pt-1 pb-4 pl-12 pointer-coarse:pl-14">
			{part.kind === "text" && <TextEditor part={part} onChange={placed.replace} />}
			<div className="grid grid-cols-2 gap-2.5">
				<NumberBox label="From left" unit="mm" value={part.xMm} limits={PLACED_LIMITS.positionMm} onChange={(xMm) => placed.update(part.id, { xMm })} />
				<NumberBox label="From top" unit="mm" value={part.yMm} limits={PLACED_LIMITS.positionMm} onChange={(yMm) => placed.update(part.id, { yMm })} />
				<NumberBox label="Width" unit="mm" value={part.wMm} limits={PLACED_LIMITS.sizeMm} onChange={(wMm) => placed.update(part.id, { wMm })} />
				<NumberBox label="Height" unit="mm" value={part.hMm} limits={PLACED_LIMITS.sizeMm} onChange={(hMm) => placed.update(part.id, { hMm })} />
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-[15px]">Nudge 0.5 mm</span>
				{(
					[
						[ArrowLeftIcon, "left", -0.5, 0],
						[ArrowUpIcon, "up", 0, -0.5],
						[ArrowDownIcon, "down", 0, 0.5],
						[ArrowLeftIcon, "right", 0.5, 0],
					] as const
				).map(([Icon, name, dx, dy]) => (
					<button
						key={name}
						type="button"
						aria-label={`Move ${name}`}
						onClick={() => placed.nudge(part.id, dx, dy)}
						className={button({ variant: "outline", size: "sm" })}
					>
						<Icon size={18} className={name === "right" ? "rotate-180" : undefined} />
					</button>
				))}
			</div>
			<button
				type="button"
				onClick={() => placed.remove(part.id)}
				className="inline-flex h-11 w-fit items-center gap-2 rounded-md text-base font-bold text-hold underline underline-offset-2"
			>
				<TrashIcon size={18} />
				Remove
			</button>
		</div>
	);
}

function TextEditor({ part, onChange }: { part: PlacedText; onChange: (part: PlacedText) => void }) {
	const size = textSizeOf(part);
	const bold = part.paragraphs.every((p) => p.runs.every((r) => r.weight === 700));
	const align = part.paragraphs[0]?.align ?? "left";
	return (
		<>
			{part.paragraphs.map((p, i) => (
				<label key={i} className="flex flex-col gap-1.5">
					<span className={labelClass}>{part.paragraphs.length > 1 ? `Line ${i + 1}` : "Text"}</span>
					<input
						value={p.runs.map((r) => r.text).join("")}
						maxLength={PLACED_LIMITS.textLength}
						onChange={(e) => onChange(setParagraphText(part, i, e.target.value))}
						className={`${panelFieldClass.replace("bg-stock", "bg-wash")} font-bold`}
					/>
				</label>
			))}
			<div className="flex items-center justify-between gap-3">
				<span className="text-[15px]">Size</span>
				<Stepper label="Text size" unit="pt" step={0.5} value={size} limits={PLACED_LIMITS.textPt} onChange={(sizePt) => onChange(setTextSize(part, sizePt))} />
			</div>
			<Segmented
				label="Weight"
				size="sm"
				value={bold ? "700" : "400"}
				options={[
					["400", "Regular"],
					["700", "Bold"],
				]}
				onChange={(v) =>
					onChange({
						...part,
						paragraphs: part.paragraphs.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, weight: Number(v) as 400 | 700 })) })),
					})
				}
			/>
			<Segmented
				label="Align"
				size="sm"
				value={align}
				options={ALIGNS}
				onChange={(a) => onChange({ ...part, hAlign: a, paragraphs: part.paragraphs.map((p) => ({ ...p, align: a })) })}
			/>
		</>
	);
}
