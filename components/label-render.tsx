// Draws a label from its design. The library tiles, the editor preview and the
// print page all use this, so what you see is what prints. Every size is in
// label millimetres through the --mm variable: screen sets it to a pixel
// scale, print sets it to 1mm.

import type { CSSProperties } from "react";
import { Barcode } from "./barcode-svg";
import { PlacedRender } from "./placed-render";
import { type FieldValues, fillText, isPlaced, textsOf, type LabelDesign, MM_PER_PT, type StackDesign, TEXT_LINE_HEIGHT } from "@/entities/label";

export type LabelRenderProps = {
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
	/** Where a picture comes from; by default the stored copy (/label-images/…). Upload previews use the file itself. */
	imageSrc?: (hash: string) => string;
	className?: string;
};

const mm = (n: number) => `calc(var(--mm) * ${n})`;

export function LabelRender(props: LabelRenderProps) {
	return isPlaced(props.design) ? <PlacedRender {...props} design={props.design} /> : <StackRender {...props} design={props.design} />;
}

/** --mm for a scale: pixels per mm, true size, or fit a square container (container-type: size). */
export const mmVariable = (scale: LabelRenderProps["scale"], design: { widthMm: number; heightMm: number }) =>
	scale === "print" ? "1mm" : scale === "fit" ? `calc(100cqmin / ${Math.max(design.widthMm, design.heightMm)})` : `${scale}px`;

function StackRender({ design, barcode, values = {}, scale, selectedId, className = "" }: LabelRenderProps & { design: StackDesign }) {
	const style = {
		"--mm": mmVariable(scale, design),
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

export const labelSummary = (design: LabelDesign, values: FieldValues) => {
	const texts = textsOf(design).map((t) => fillText(t, values));
	return `Label, ${design.widthMm} by ${design.heightMm} mm: ${texts.slice(0, 4).join(", ")}`;
};
