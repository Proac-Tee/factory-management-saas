// A label is a sheet of a set size (in mm) with parts stacked top to bottom,
// like the LibreOffice labels it replaces: text in points, the logo and
// barcode in millimetres. Text can hold fields ({batch}, {bbe}, {qty}) that are
// filled in when the label is printed.

import { z } from "zod";
import { optionalGtinSchema } from "./gtin";
import { type PlacedDesign, placedDesignSchema } from "./placed";
import { firstIssue, rangeSchema, tidyText } from "./validation";

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

// ─── Layout ──────────────────────────────────────────────────────────────────
// A design comes from the editor or from the database (jsonb), so it is
// parsed before it is saved or drawn: a bad value can't reach the preview or
// the printer. Messages say what to fix, in the editor's words.

const partId = z.string({ error: "needs its own id." }).min(1, { error: "needs its own id." });
/** Anything but an explicit false shows the part (older designs left it out). */
const visible = z.unknown().optional().transform((v) => v !== false);

const textPartSchema = z.object({
	id: partId,
	kind: z.literal("text"),
	text: z
		.string({ error: "has no text." })
		.max(LIMITS.textLength, { error: `keep text under ${LIMITS.textLength} characters.` }),
	sizePt: rangeSchema(LIMITS.textPt, `text size must be ${LIMITS.textPt.min} to ${LIMITS.textPt.max} pt.`),
	weight: z.union([z.literal(400), z.literal(700), z.literal(900)]).catch(700),
	align: z.enum(["left", "center", "right"]).catch("center"),
	visible,
});

const logoPartSchema = z.object({
	id: partId,
	kind: z.literal("logo"),
	heightMm: rangeSchema(LIMITS.blockMm, `logo height must be ${LIMITS.blockMm.min} to ${LIMITS.blockMm.max} mm.`),
	visible,
});

const barcodePartSchema = z.object({
	id: partId,
	kind: z.literal("barcode"),
	heightMm: rangeSchema(LIMITS.blockMm, `barcode height must be ${LIMITS.blockMm.min} to ${LIMITS.blockMm.max} mm.`),
	/** Size of the digits printed under the bars; 0 hides them. */
	numberSizePt: rangeSchema(
		LIMITS.numberPt,
		`barcode number size must be ${LIMITS.numberPt.min} to ${LIMITS.numberPt.max} pt.`,
	),
	visible,
});

const partSchema = z.discriminatedUnion("kind", [textPartSchema, logoPartSchema, barcodePartSchema], {
	error: "isn't a text, logo or barcode part.",
});

const { sizeMm, marginMm, gapMm } = LIMITS;

export const stackDesignSchema = z
	.object(
		{
			widthMm: rangeSchema(sizeMm, `Width must be ${sizeMm.min} to ${sizeMm.max} mm.`),
			heightMm: rangeSchema(sizeMm, `Height must be ${sizeMm.min} to ${sizeMm.max} mm.`),
			marginMm: rangeSchema(marginMm, `Margin must be ${marginMm.min} to ${marginMm.max} mm.`),
			/** Space between two shown parts */
			gapMm: rangeSchema(gapMm, `Space between parts must be ${gapMm.min} to ${gapMm.max} mm.`),
			parts: z
				.array(partSchema, { error: "The label has no parts." })
				.max(LIMITS.parts, { error: `A label can have up to ${LIMITS.parts} parts.` }),
		},
		{ error: "The label has no layout." },
	)
	.superRefine((design, ctx) => {
		if (2 * design.marginMm >= Math.min(design.widthMm, design.heightMm)) {
			ctx.addIssue({ code: "custom", path: ["marginMm"], message: "The margin leaves no room on the label." });
		}
		const seen = new Set<string>();
		design.parts.forEach((part, index) => {
			if (seen.has(part.id)) ctx.addIssue({ code: "custom", path: ["parts", index, "id"], message: "needs its own id." });
			seen.add(part.id);
		});
	});

/** A label laid out as parts stacked top to bottom (labels made in the app). */
export type StackDesign = z.output<typeof stackDesignSchema>;
/** Either layout: stacked, or placed as in the imported LibreOffice files. */
export type LabelDesign = StackDesign | PlacedDesign;
export type LabelPart = StackDesign["parts"][number];
export type TextPart = Extract<LabelPart, { kind: "text" }>;
export type LogoPart = Extract<LabelPart, { kind: "logo" }>;
export type BarcodePart = Extract<LabelPart, { kind: "barcode" }>;
export type Align = TextPart["align"];
export type Weight = TextPart["weight"];

export type DesignCheck = { ok: true; design: LabelDesign } | { ok: false; message: string };

export const isPlaced = (design: LabelDesign): design is PlacedDesign => "layout" in design && design.layout === "placed";

/** True when the design shows a barcode but the label has no number for it yet. */
export const needsBarcodeNumber = (design: LabelDesign, barcode: string | null): boolean =>
	!barcode && design.parts.some((part) => part.kind === "barcode" && part.visible);

/** Parses a design of either layout; a problem with one part is told as "Part 3: …". */
export const parseDesign = (value: unknown): DesignCheck => {
	const placed = typeof value === "object" && value !== null && (value as { layout?: unknown }).layout === "placed";
	const result = placed ? placedDesignSchema.safeParse(value) : stackDesignSchema.safeParse(value);
	if (result.success) return { ok: true, design: result.data };
	const [issue] = result.error.issues;
	const [field, index] = issue.path;
	const message = field === "parts" && typeof index === "number" ? `Part ${index + 1}: ${issue.message}` : issue.message;
	return { ok: false, message };
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

/** The text a design shows, line by line, in either layout. */
export const textsOf = (design: LabelDesign): string[] =>
	isPlaced(design)
		? design.parts.flatMap((p) => (p.kind === "text" && p.visible ? p.paragraphs.map((q) => q.runs.map((r) => r.text).join("")) : []))
		: design.parts.flatMap((p) => (p.kind === "text" && p.visible ? [p.text] : []));

/** The fields a design asks for, in FIELDS order. */
export const fieldsUsed = (design: LabelDesign): FieldKey[] => {
	const used = new Set<string>();
	for (const text of textsOf(design)) {
		for (const match of text.matchAll(FIELD_PATTERN)) used.add(match[1]);
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
export const checkFit = (design: StackDesign): Fit => {
	const shown = design.parts.filter((p) => p.visible);
	const partsMm = shown.reduce((sum, p) => sum + partHeightMm(p), 0);
	const gapsMm = Math.max(shown.length - 1, 0) * design.gapMm;
	const usedMm = round1(2 * design.marginMm + partsMm + gapsMm);
	const spareMm = round1(design.heightMm - usedMm);
	return { usedMm, spareMm, fits: spareMm >= 0 };
};

/** Width text can use: the label minus its side margins. */
export const usableWidthMm = (design: StackDesign): number =>
	design.widthMm - 2 * design.marginMm;

// ─── Label details (not layout) ──────────────────────────────────────────────
// A label sits in the library under its customer, then its product (by
// SKU), then its kind. Labels with no SKU (hold, waste, address…) sit under
// the customer's "General" group.

export const SKU_PATTERN = /^[A-Z0-9-]{3,20}$/;

export const skuSchema = z
	.string()
	.trim()
	.toUpperCase()
	.regex(SKU_PATTERN, { error: "SKU is 3 to 20 letters, digits or dashes, like 10145." });

export const productNameSchema = tidyText.pipe(
	z
		.string()
		.min(1, { error: "Name the product, like Original Biltong 15 × 45g." })
		.max(60, { error: "Keep the product name under 60 characters." }),
);

export const labelDetailsSchema = z
	.object({
		name: tidyText.pipe(
			z
				.string()
				.min(1, { error: "Give the label a name people will search for." })
				.max(80, { error: "Keep the name under 80 characters." }),
		),
		customer: tidyText.pipe(
			z
				.string()
				.min(1, { error: "Say who the label is for, or Ember for our own." })
				.max(40, { error: "Keep the customer under 40 characters." }),
		),
		kind: z.enum(LABEL_KINDS, { error: "Pick the kind of label." }),
		sku: z.string().transform((s) => s.trim()),
		productName: z.string(),
		storage: z
			.enum([...STORAGE_TYPES, ""], { error: "Storage is ambient, chilled or not shown." })
			.transform((s) => (s === "" ? null : s)),
		barcode: optionalGtinSchema,
	})
	.transform((details, ctx) => {
		// No SKU: not tied to a product, so any product name is ignored.
		if (details.sku === "") return { ...details, sku: null, productName: null };
		const sku = skuSchema.safeParse(details.sku);
		if (!sku.success) ctx.addIssue({ code: "custom", path: ["sku"], message: sku.error.issues[0].message });
		const productName = productNameSchema.safeParse(details.productName);
		if (!productName.success) {
			ctx.addIssue({ code: "custom", path: ["productName"], message: productName.error.issues[0].message });
		}
		if (!sku.success || !productName.success) return z.NEVER;
		return { ...details, sku: sku.data, productName: productName.data };
	});

/** What the details form sends: every field as typed. */
export type LabelDetailsInput = z.input<typeof labelDetailsSchema>;
export type LabelDetails = z.output<typeof labelDetailsSchema>;
export type DetailsField = keyof LabelDetailsInput;

export type DetailsCheck = { ok: true; details: LabelDetails } | { ok: false; field?: DetailsField; message: string };

/** Checks the name, grouping and barcode of a label. */
export const checkDetails = (input: unknown): DetailsCheck => {
	const result = labelDetailsSchema.safeParse(input);
	return result.success ? { ok: true, details: result.data } : firstIssue<DetailsField>(result.error);
};

// ─── A fresh label ───────────────────────────────────────────────────────────

/** The default case label, as on the printed Ember SRP labels. */
export const newDesign = (): StackDesign => ({
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
