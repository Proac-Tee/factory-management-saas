// Draws a label from its design. The library tiles, the editor preview and the
// print page all use this, so what you see is what prints. Every size is in
// label millimetres through the --mm variable: screen sets it to a pixel
// scale, print sets it to 1mm.

import type { CSSProperties } from "react";
import { barsFor } from "@/entities/barcodes";
import { type FieldValues, fillText, type LabelDesign, MM_PER_PT, TEXT_LINE_HEIGHT } from "@/entities/label";

type Props = {
	design: LabelDesign;
	barcode: string | null;
	values?: FieldValues;
	/**
	 * Pixels per label millimetre on screen; "print" for true size; "fit" to
	 * fill a square parent that has container-type: size (library tiles).
	 */
	scale: number | "print" | "fit";
	/** Outline this part (the one being sized in the editor). */
	selectedId?: string | null;
	className?: string;
};

const mm = (n: number) => `calc(var(--mm) * ${n})`;

export function LabelRender({ design, barcode, values = {}, scale, selectedId, className = "" }: Props) {
	const style = {
		"--mm":
			scale === "print"
				? "1mm"
				: scale === "fit"
					? `calc(100cqmin / ${Math.max(design.widthMm, design.heightMm)})`
					: `${scale}px`,
		width: mm(design.widthMm),
		height: mm(design.heightMm),
		padding: mm(design.marginMm),
		gap: mm(design.gapMm),
	} as CSSProperties;

	return (
		<div
			role="img"
			aria-label={labelSummary(design, values)}
			className={`flex shrink-0 flex-col items-stretch overflow-hidden bg-stock text-ink ${className}`}
			style={style}
		>
			{design.parts
				.filter((part) => part.visible)
				.map((part) => {
					const selected = part.id === selectedId;
					const outline = selected ? "outline-2 outline-offset-2 outline-dashed outline-ink" : "";
					if (part.kind === "logo") {
						return (
							<div key={part.id} className={`flex shrink-0 justify-center ${outline}`} style={{ height: mm(part.heightMm) }}>
								{/* A plain img: the label must print exactly, without next/image wrappers. */}
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src="/ember-logo.png" alt="" className="h-full w-auto" />
							</div>
						);
					}
					if (part.kind === "barcode") {
						return (
							<div key={part.id} className={`flex shrink-0 flex-col items-center ${outline}`}>
								<Barcode gtin={barcode} heightMm={part.heightMm} />
								{part.numberSizePt > 0 && barcode && (
									<p
										className="whitespace-nowrap tabular-nums"
										style={{
											fontSize: mm(part.numberSizePt * MM_PER_PT),
											lineHeight: TEXT_LINE_HEIGHT,
											letterSpacing: "0.06em",
										}}
									>
										{barcode}
									</p>
								)}
							</div>
						);
					}
					return (
						<p
							key={part.id}
							className={`shrink-0 overflow-hidden whitespace-pre tabular-nums ${outline}`}
							style={{
								fontSize: mm(part.sizePt * MM_PER_PT),
								lineHeight: TEXT_LINE_HEIGHT,
								fontWeight: part.weight,
								textAlign: part.align,
							}}
						>
							{fillText(part.text, values)}
						</p>
					);
				})}
		</div>
	);
}

/** ITF-14 with its bearer bars top and bottom, or EAN-13, across the usable width. */
function Barcode({ gtin, heightMm }: { gtin: string | null; heightMm: number }) {
	if (!gtin) {
		return (
			<div
				className="flex w-full items-center justify-center border-2 border-dashed border-rule px-2 text-center text-graphite"
				style={{ height: mm(heightMm), fontSize: mm(3) }}
			>
				Add the barcode number in Details
			</div>
		);
	}
	const { bars, width } = barsFor(gtin);
	const itf = gtin.length === 14;
	const quiet = itf ? 10 : 9;
	const total = width + 2 * quiet;
	return (
		<svg
			viewBox={`0 0 ${total} 100`}
			preserveAspectRatio="none"
			aria-hidden="true"
			className="block w-full"
			style={{ height: mm(heightMm) }}
		>
			{itf && (
				<>
					<rect x={0} y={0} width={total} height={7} fill="currentColor" />
					<rect x={0} y={93} width={total} height={7} fill="currentColor" />
				</>
			)}
			{bars.map((bar) => (
				<rect
					key={bar.x}
					x={quiet + bar.x}
					y={itf ? 7 : 0}
					width={bar.width}
					height={itf ? 86 : 100}
					fill="currentColor"
				/>
			))}
		</svg>
	);
}

const labelSummary = (design: LabelDesign, values: FieldValues) => {
	const texts = design.parts.filter((p) => p.visible && p.kind === "text").map((p) => (p.kind === "text" ? fillText(p.text, values) : ""));
	return `Label, ${design.widthMm} by ${design.heightMm} mm: ${texts.slice(0, 4).join(", ")}`;
};
