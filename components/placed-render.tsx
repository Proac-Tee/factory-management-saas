// Draws a "placed" label (entities/placed.ts): every part at its position and
// size in label millimetres, like the LibreOffice file it came from. Shares
// the --mm scale with label-render, so the library, editor and print agree.

import type { CSSProperties } from "react";
import { fillText, MM_PER_PT } from "@/entities/label";
import type { FontKey, PlacedDesign, PlacedPart, PlacedText } from "@/entities/placed";
import { Barcode } from "./barcode-svg";
import { type LabelRenderProps, labelSummary, mmVariable } from "./label-render";

const mm = (n: number) => `calc(var(--mm) * ${n})`;

/** The free fonts that stand in for the originals with the same letter widths (app/layout.tsx). */
const FONT_FAMILY: Record<FontKey, string> = {
	cambria: "var(--font-caladea), Cambria, serif",
	"liberation-serif": "var(--font-tinos), 'Liberation Serif', 'Times New Roman', serif",
	"liberation-sans": "var(--font-arimo), 'Liberation Sans', Arial, sans-serif",
	"noto-sans": "var(--font-noto-sans), 'Noto Sans', sans-serif",
};

const FLEX: Record<string, string> = { left: "flex-start", top: "flex-start", center: "center", middle: "center", right: "flex-end", bottom: "flex-end" };

const storedImage = (hash: string) => `/label-images/${hash}`;

export function PlacedRender({
	design,
	barcode,
	values = {},
	scale,
	selectedId,
	imageSrc = storedImage,
	className = "",
}: LabelRenderProps & { design: PlacedDesign }) {
	return (
		<div
			role="img"
			aria-label={labelSummary(design, values)}
			className={`relative shrink-0 overflow-hidden bg-stock text-ink ${className}`}
			style={
				{
					"--mm": mmVariable(scale, design),
					width: mm(design.widthMm),
					height: mm(design.heightMm),
				} as CSSProperties
			}
		>
			{design.parts
				.filter((part) => part.visible)
				.map((part) => (
					<div
						key={part.id}
						className={`absolute ${part.id === selectedId ? "outline-2 outline-offset-1 outline-dashed outline-ink" : ""}`}
						style={{
							left: mm(part.xMm),
							top: mm(part.yMm),
							width: mm(part.wMm),
							height: mm(part.hMm),
							transform: part.rotateDeg ? `rotate(${part.rotateDeg}deg)` : undefined,
							transformOrigin: "0 0",
						}}
					>
						<PartBody part={part} barcode={barcode} values={values} imageSrc={imageSrc} />
					</div>
				))}
		</div>
	);
}

function PartBody({
	part,
	barcode,
	values,
	imageSrc,
}: { part: PlacedPart; barcode: string | null; values: LabelRenderProps["values"]; imageSrc: (hash: string) => string }) {
	if (part.kind === "text") return <TextBody part={part} values={values ?? {}} />;
	if (part.kind === "image") {
		// The kept middle of a cropped picture fills the box: scale the whole
		// picture up by what was cut, and shift it by the top and left cuts.
		const [t, r, b, l] = part.crop;
		const keptW = 1 - l - r;
		const keptH = 1 - t - b;
		return part.image ? (
			<div className="relative h-full w-full overflow-hidden">
				{/* A plain img: the label must print exactly, without next/image wrappers. */}
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={imageSrc(part.image)}
					alt=""
					className="absolute block max-w-none"
					style={{ width: `${100 / keptW}%`, height: `${100 / keptH}%`, left: `${(-l / keptW) * 100}%`, top: `${(-t / keptH) * 100}%` }}
					draggable={false}
				/>
			</div>
		) : (
			<div className="flex h-full w-full items-center justify-center border border-dashed border-rule text-center text-graphite" style={{ fontSize: mm(2.5) }}>
				Picture not shown
			</div>
		);
	}
	if (part.kind === "shape") {
		return (
			<svg
				viewBox={`0 0 ${part.viewBox[0]} ${part.viewBox[1]}`}
				preserveAspectRatio="none"
				aria-hidden="true"
				className="block h-full w-full overflow-visible"
			>
				<path d={part.d} fill={part.fill ?? "none"} stroke={part.stroke ?? "none"} strokeWidth={part.strokeWidth} />
			</svg>
		);
	}
	return (
		<div className="flex h-full w-full flex-col items-center">
			<Barcode gtin={barcode} heightMm={Math.max(part.hMm - part.numberSizePt * MM_PER_PT * 1.15, 1)} />
			{part.numberSizePt > 0 && barcode && (
				<p className="whitespace-nowrap tabular-nums" style={{ fontSize: mm(part.numberSizePt * MM_PER_PT), lineHeight: 1.15, letterSpacing: "0.06em" }}>
					{barcode}
				</p>
			)}
		</div>
	);
}

/** A text box: the block of paragraphs sits in the box as LibreOffice aligns it; lines don't wrap unless the box is fixed-width. */
function TextBody({ part, values }: { part: PlacedText; values: NonNullable<LabelRenderProps["values"]> }) {
	const [top, right, bottom, left] = part.paddingMm;
	return (
		<div
			className="flex h-full w-full flex-col"
			style={{
				justifyContent: FLEX[part.vAlign],
				alignItems: part.wrap ? "stretch" : FLEX[part.hAlign],
				padding: `${mm(top)} ${mm(right)} ${mm(bottom)} ${mm(left)}`,
			}}
		>
			<div style={{ whiteSpace: part.wrap ? "pre-wrap" : "pre", minWidth: part.wrap ? undefined : "max-content" }}>
				{part.paragraphs.map((p, i) => (
					<p key={i} style={{ textAlign: p.align, fontSize: mm(p.sizePt * MM_PER_PT), lineHeight: "normal" }}>
						{p.runs.length === 0
							? " "
							: p.runs.map((run, j) => (
									<span
										key={j}
										style={{
											fontSize: mm(run.sizePt * MM_PER_PT),
											fontWeight: run.weight,
											fontStyle: run.italic ? "italic" : undefined,
											fontFamily: FONT_FAMILY[run.font],
											color: run.color,
										}}
									>
										{fillText(run.text, values)}
									</span>
								))}
					</p>
				))}
			</div>
		</div>
	);
}
