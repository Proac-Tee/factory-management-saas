// Changes the editor makes to a placed design. Pure: each takes a design and
// gives back a new one.

import type { Paragraph, PlacedDesign, PlacedPart, PlacedText } from "./placed";

const round2 = (n: number) => Math.round(n * 100) / 100;

export const updatePlacedPart = (design: PlacedDesign, id: string, patch: Partial<PlacedPart>): PlacedDesign => ({
	...design,
	parts: design.parts.map((p) => (p.id === id ? ({ ...p, ...patch } as PlacedPart) : p)),
});

/** Moves a part by a step in mm (arrow buttons), keeping it inside the label. */
export const nudgePart = (design: PlacedDesign, id: string, dxMm: number, dyMm: number): PlacedDesign => ({
	...design,
	parts: design.parts.map((p) =>
		p.id === id
			? { ...p, xMm: round2(Math.min(Math.max(p.xMm + dxMm, -p.wMm), design.widthMm)), yMm: round2(Math.min(Math.max(p.yMm + dyMm, -p.hMm), design.heightMm)) }
			: p,
	),
});

export const removePlacedPart = (design: PlacedDesign, id: string): PlacedDesign => ({
	...design,
	parts: design.parts.filter((p) => p.id !== id),
});

/**
 * Replaces a paragraph's text, keeping the look of its first run (the
 * editor edits whole lines; mixed sizes within a line become one size).
 */
export const setParagraphText = (part: PlacedText, index: number, text: string): PlacedText => ({
	...part,
	paragraphs: part.paragraphs.map((p, i): Paragraph => {
		if (i !== index) return p;
		const look = p.runs[0] ?? { sizePt: p.sizePt, weight: 700 as const, italic: false, font: "cambria" as const, color: "#000000" };
		return { ...p, runs: text === "" ? [] : [{ ...look, text }] };
	}),
});

/** Sets the size of every run in a text box (the editor's size stepper). */
export const setTextSize = (part: PlacedText, sizePt: number): PlacedText => ({
	...part,
	paragraphs: part.paragraphs.map((p) => ({ ...p, sizePt, runs: p.runs.map((r) => ({ ...r, sizePt })) })),
});

/** The largest size used in a text box, to show on its stepper. */
export const textSizeOf = (part: PlacedText): number =>
	Math.max(...part.paragraphs.flatMap((p) => [p.sizePt, ...p.runs.map((r) => r.sizePt)]), 0);

/** A new one-line text box near the top left. */
export const newTextPart = (id: string): PlacedText => ({
	id,
	kind: "text",
	xMm: 5,
	yMm: 5,
	wMm: 40,
	hMm: 7,
	rotateDeg: 0,
	visible: true,
	hAlign: "left",
	vAlign: "top",
	wrap: false,
	paddingMm: [0, 0, 0, 0],
	paragraphs: [{ align: "left", sizePt: 16, runs: [{ text: "NEW LINE", sizePt: 16, weight: 700, italic: false, font: "cambria", color: "#000000" }] }],
});

export const addPlacedPart = (design: PlacedDesign, part: PlacedPart): PlacedDesign => ({ ...design, parts: [...design.parts, part] });

/** A short name for a part in the parts list. */
export const placedPartName = (part: PlacedPart): string => {
	if (part.kind === "text") return part.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join(" ").trim() || "Empty text";
	if (part.kind === "image") return part.scanned ? `Barcode picture (${part.scanned})` : "Picture";
	if (part.kind === "barcode") return "Barcode";
	return "Shape";
};
