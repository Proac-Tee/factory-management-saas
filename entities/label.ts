// A label is a sheet of a set size (in mm) with parts stacked top to bottom,
// like the LibreOffice labels it replaces: text in points, the logo and
// barcode in millimetres. Text can hold fields ({batch}, {bbe}, {qty}) that are
// filled in when the label is printed.

import { checkGtin } from "./gtin";

export const MM_PER_PT = 25.4 / 72;
/** Line height of label text, as a multiple of its size. */
export const TEXT_LINE_HEIGHT = 1.15;

export const LABEL_KINDS = [
	"srp",
	"shipper",
	"pallet",
	"hold",
	"waste",
	"sample",
	"address",
	"barcode",
	"other",
] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

export const KIND_NAMES: Record<LabelKind, string> = {
	srp: "SRP",
	shipper: "Shipper",
	pallet: "Pallet",
	hold: "Hold",
	waste: "Waste",
	sample: "Sample",
	address: "Address",
	barcode: "Barcode only",
	other: "Other",
};

export const STORAGE_TYPES = ["ambient", "chilled"] as const;
export type Storage = (typeof STORAGE_TYPES)[number];

/** The sizes the printer stock comes in. Any size can still be typed. */
export const SIZE_PRESETS = [
	{ widthMm: 100, heightMm: 100 },
	{ widthMm: 80, heightMm: 130 },
	{ widthMm: 50, heightMm: 25 },
] as const;

export const LIMITS = {
	sizeMm: { min: 10, max: 300 },
	marginMm: { min: 0, max: 30 },
	gapMm: { min: 0, max: 20 },
	textPt: { min: 4, max: 120 },
	blockMm: { min: 2, max: 200 },
	numberPt: { min: 0, max: 40 },
	parts: 30,
	textLength: 120,
} as const;

export type Align = "left" | "center" | "right";
export type Weight = 400 | 700 | 900;

export type TextPart = {
	id: string;
	kind: "text";
	text: string;
	sizePt: number;
	weight: Weight;
	align: Align;
	visible: boolean;
};
export type LogoPart = { id: string; kind: "logo"; heightMm: number; visible: boolean };
export type BarcodePart = {
	id: string;
	kind: "barcode";
	heightMm: number;
	/** Size of the digits printed under the bars; 0 hides them. */
	numberSizePt: number;
	visible: boolean;
};
export type LabelPart = TextPart | LogoPart | BarcodePart;

export type LabelDesign = {
	widthMm: number;
	heightMm: number;
	marginMm: number;
	/** Space between two shown parts */
	gapMm: number;
	parts: LabelPart[];
};

// ─── Fields filled in at print time ──────────────────────────────────────────

export const FIELDS = [
	{ key: "batch", name: "Batch", example: "AN1210601" },
	{ key: "bbe", name: "BBE", example: "12.10.27" },
	{ key: "qty", name: "Quantity", example: "25" },
] as const;
export type FieldKey = (typeof FIELDS)[number]["key"];
export type FieldValues = Partial<Record<FieldKey, string>>;

const FIELD_PATTERN = /\{(batch|bbe|qty)\}/g;

/** The fields a design asks for, in FIELDS order. */
export const fieldsUsed = (design: LabelDesign): FieldKey[] => {
	const used = new Set<string>();
	for (const part of design.parts) {
		if (part.kind !== "text" || !part.visible) continue;
		for (const match of part.text.matchAll(FIELD_PATTERN)) used.add(match[1]);
	}
	return FIELDS.map((f) => f.key).filter((key) => used.has(key));
};

/** Puts the values into the text. A missing value shows as its example. */
export const fillText = (text: string, values: FieldValues): string =>
	text.replace(FIELD_PATTERN, (_, key: FieldKey) => {
		const value = values[key]?.trim();
		return value || FIELDS.find((f) => f.key === key)!.example;
	});

// ─── Fit ─────────────────────────────────────────────────────────────────────

export const partHeightMm = (part: LabelPart): number => {
	if (part.kind === "text") return part.sizePt * MM_PER_PT * TEXT_LINE_HEIGHT;
	if (part.kind === "barcode") {
		return part.heightMm + part.numberSizePt * MM_PER_PT * TEXT_LINE_HEIGHT;
	}
	return part.heightMm;
};

export type Fit = { usedMm: number; spareMm: number; fits: boolean };

/** How much of the label's height the shown parts use, margins included. */
export const checkFit = (design: LabelDesign): Fit => {
	const shown = design.parts.filter((p) => p.visible);
	const partsMm = shown.reduce((sum, p) => sum + partHeightMm(p), 0);
	const gapsMm = Math.max(shown.length - 1, 0) * design.gapMm;
	const usedMm = round1(2 * design.marginMm + partsMm + gapsMm);
	const spareMm = round1(design.heightMm - usedMm);
	return { usedMm, spareMm, fits: spareMm >= 0 };
};

/** Width text can use: the label minus its side margins. */
export const usableWidthMm = (design: LabelDesign): number =>
	design.widthMm - 2 * design.marginMm;

// ─── Reading a design back from the database ─────────────────────────────────

export type DesignCheck =
	| { ok: true; design: LabelDesign }
	| { ok: false; message: string };

const inRange = (n: unknown, { min, max }: { min: number; max: number }) =>
	typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

/**
 * Checks a design from the editor or the database (jsonb) before it is
 * saved or drawn, so a bad value can't reach the preview or the printer.
 * Messages say what to fix, in the editor's words.
 */
export const parseDesign = (value: unknown): DesignCheck => {
	if (typeof value !== "object" || value === null) return fail("The label has no layout.");
	const { widthMm, heightMm, marginMm, gapMm, parts } = value as Record<string, unknown>;
	const { sizeMm, marginMm: marginLimit, gapMm: gapLimit } = LIMITS;
	if (!inRange(widthMm, sizeMm)) return fail(`Width must be ${sizeMm.min} to ${sizeMm.max} mm.`);
	if (!inRange(heightMm, sizeMm)) return fail(`Height must be ${sizeMm.min} to ${sizeMm.max} mm.`);
	if (!inRange(marginMm, marginLimit)) return fail(`Margin must be ${marginLimit.min} to ${marginLimit.max} mm.`);
	if (!inRange(gapMm, gapLimit)) return fail(`Space between parts must be ${gapLimit.min} to ${gapLimit.max} mm.`);
	if (2 * (marginMm as number) >= Math.min(widthMm as number, heightMm as number)) {
		return fail("The margin leaves no room on the label.");
	}
	if (!Array.isArray(parts)) return fail("The label has no parts.");
	if (parts.length > LIMITS.parts) return fail(`A label can have up to ${LIMITS.parts} parts.`);

	const checked: LabelPart[] = [];
	const ids = new Set<string>();
	for (const [index, raw] of parts.entries()) {
		const where = `Part ${index + 1}`;
		if (typeof raw !== "object" || raw === null) return fail(`${where} is empty.`);
		const p = raw as Record<string, unknown>;
		if (typeof p.id !== "string" || p.id === "" || ids.has(p.id)) return fail(`${where} needs its own id.`);
		ids.add(p.id);
		const visible = p.visible !== false;

		if (p.kind === "text") {
			if (typeof p.text !== "string") return fail(`${where} has no text.`);
			if (p.text.length > LIMITS.textLength) return fail(`${where}: keep text under ${LIMITS.textLength} characters.`);
			if (!inRange(p.sizePt, LIMITS.textPt)) return fail(`${where}: text size must be ${LIMITS.textPt.min} to ${LIMITS.textPt.max} pt.`);
			const weight = p.weight === 400 || p.weight === 700 || p.weight === 900 ? p.weight : 700;
			const align = p.align === "left" || p.align === "right" ? p.align : "center";
			checked.push({ id: p.id, kind: "text", text: p.text, sizePt: p.sizePt as number, weight, align, visible });
		} else if (p.kind === "logo") {
			if (!inRange(p.heightMm, LIMITS.blockMm)) return fail(`Logo height must be ${LIMITS.blockMm.min} to ${LIMITS.blockMm.max} mm.`);
			checked.push({ id: p.id, kind: "logo", heightMm: p.heightMm as number, visible });
		} else if (p.kind === "barcode") {
			if (!inRange(p.heightMm, LIMITS.blockMm)) return fail(`Barcode height must be ${LIMITS.blockMm.min} to ${LIMITS.blockMm.max} mm.`);
			if (!inRange(p.numberSizePt, LIMITS.numberPt)) return fail(`Barcode number size must be ${LIMITS.numberPt.min} to ${LIMITS.numberPt.max} pt.`);
			checked.push({
				id: p.id,
				kind: "barcode",
				heightMm: p.heightMm as number,
				numberSizePt: p.numberSizePt as number,
				visible,
			});
		} else {
			return fail(`${where} is not a text, logo or barcode part.`);
		}
	}
	return {
		ok: true,
		design: {
			widthMm: widthMm as number,
			heightMm: heightMm as number,
			marginMm: marginMm as number,
			gapMm: gapMm as number,
			parts: checked,
		},
	};
};

// ─── Label details (not layout) ──────────────────────────────────────────────

export type LabelDetailsInput = {
	name: string;
	customer: string;
	kind: string;
	sku: string;
	storage: string;
	barcode: string;
};

export type LabelDetails = {
	name: string;
	customer: string;
	kind: LabelKind;
	sku: string | null;
	storage: Storage | null;
	barcode: string | null;
};

export type DetailsCheck =
	| { ok: true; details: LabelDetails }
	| { ok: false; field: keyof LabelDetailsInput; message: string };

/** Checks the name, grouping and barcode of a label. */
export const checkDetails = (input: LabelDetailsInput): DetailsCheck => {
	const name = input.name.trim().replace(/\s+/g, " ");
	if (name === "") return { ok: false, field: "name", message: "Give the label a name people will search for." };
	if (name.length > 80) return { ok: false, field: "name", message: "Keep the name under 80 characters." };

	const customer = input.customer.trim().replace(/\s+/g, " ");
	if (customer === "") return { ok: false, field: "customer", message: "Say who the label is for, or Ember for our own." };
	if (customer.length > 40) return { ok: false, field: "customer", message: "Keep the customer under 40 characters." };

	if (!(LABEL_KINDS as readonly string[]).includes(input.kind)) {
		return { ok: false, field: "kind", message: "Pick the kind of label." };
	}

	const sku = input.sku.trim().toUpperCase();
	if (sku !== "" && !/^[A-Z0-9-]{3,20}$/.test(sku)) {
		return { ok: false, field: "sku", message: "SKU is 3 to 20 letters, digits or dashes, like 10145." };
	}

	const storage = input.storage === "" ? null : input.storage;
	if (storage !== null && !(STORAGE_TYPES as readonly string[]).includes(storage)) {
		return { ok: false, field: "storage", message: "Storage is ambient, chilled or not shown." };
	}

	let barcode: string | null = null;
	if (input.barcode.trim() !== "") {
		const check = checkGtin(input.barcode);
		if (!check.ok) return { ok: false, field: "barcode", message: check.message };
		barcode = check.gtin;
	}

	return {
		ok: true,
		details: { name, customer, kind: input.kind as LabelKind, sku: sku || null, storage: storage as Storage | null, barcode },
	};
};

// ─── A fresh label ───────────────────────────────────────────────────────────

/** The default case label, as on the printed Ember SRP labels. */
export const newDesign = (): LabelDesign => ({
	widthMm: 100,
	heightMm: 100,
	marginMm: 4,
	gapMm: 1,
	parts: [
		{ id: "logo", kind: "logo", heightMm: 12, visible: true },
		{ id: "name", kind: "text", text: "PRODUCT NAME", sizePt: 22, weight: 900, align: "center", visible: true },
		{ id: "pack", kind: "text", text: "PACK SIZE: 15 x 45g", sizePt: 14, weight: 700, align: "center", visible: true },
		{ id: "sku", kind: "text", text: "SKU: 10000", sizePt: 16, weight: 900, align: "center", visible: true },
		{ id: "storage", kind: "text", text: "AMBIENT", sizePt: 16, weight: 900, align: "center", visible: true },
		{ id: "batch", kind: "text", text: "BATCH: {batch}   BBE: {bbe}", sizePt: 13, weight: 700, align: "center", visible: true },
		{ id: "barcode", kind: "barcode", heightMm: 24, numberSizePt: 11, visible: true },
	],
});

const round1 = (n: number) => Math.round(n * 10) / 10;
const fail = (message: string): DesignCheck => ({ ok: false, message });
