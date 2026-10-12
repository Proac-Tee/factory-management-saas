// Changes the editor makes to a design. Pure: each takes a design and gives
// back a new one, so they're easy to test and to undo later.

import type { LabelPart, StackDesign } from "./label";

type SizePreset = { widthMm: number; heightMm: number };

export const updatePart = (design: StackDesign, id: string, patch: Partial<LabelPart>): StackDesign => ({
	...design,
	parts: design.parts.map((p) => (p.id === id ? ({ ...p, ...patch } as LabelPart) : p)),
});

/** Swaps a part with its neighbour above (-1) or below (1). Out of range does nothing. */
export const movePart = (design: StackDesign, id: string, by: -1 | 1): StackDesign => {
	const i = design.parts.findIndex((p) => p.id === id);
	const j = i + by;
	if (i < 0 || j < 0 || j >= design.parts.length) return design;
	const parts = [...design.parts];
	[parts[i], parts[j]] = [parts[j], parts[i]];
	return { ...design, parts };
};

export const removePart = (design: StackDesign, id: string): StackDesign => ({
	...design,
	parts: design.parts.filter((p) => p.id !== id),
});

/** A new part with sensible sizes, added at the bottom. */
export const newPart = (kind: LabelPart["kind"], id: string): LabelPart =>
	kind === "text"
		? { id, kind, text: "NEW LINE", sizePt: 14, weight: 700, align: "center", visible: true }
		: kind === "logo"
			? { id, kind, heightMm: 12, visible: true }
			: { id, kind, heightMm: 24, numberSizePt: 11, visible: true };

export const addPart = (design: StackDesign, part: LabelPart): StackDesign => ({
	...design,
	parts: [...design.parts, part],
});

/** Only one logo and one barcode make sense on a label. */
export const canAdd = (design: StackDesign, kind: LabelPart["kind"]) =>
	kind === "text" || !design.parts.some((p) => p.kind === kind);

/** Sets a stock size; small labels get a small margin so they keep room for parts. */
export const applyPreset = (design: StackDesign, preset: SizePreset): StackDesign => ({
	...design,
	widthMm: preset.widthMm,
	heightMm: preset.heightMm,
	marginMm: preset.heightMm < 40 ? 1.5 : design.marginMm,
});

export const matchingPreset = <P extends SizePreset>(design: StackDesign, presets: readonly P[]) =>
	presets.find((p) => p.widthMm === Math.round(design.widthMm) && p.heightMm === Math.round(design.heightMm));
