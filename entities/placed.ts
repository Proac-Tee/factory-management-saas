// A "placed" label: every part has its own position and size in millimetres,
// as in the LibreOffice files it comes from. Text keeps its runs (size,
// weight, font), pictures are stored once and referenced by their SHA-256,
// and drawn shapes (bars, borders) keep their SVG path. The stacked layout in
// ./label.ts stays for labels made in the app.

import { z } from "zod";

export const FONTS = ["cambria", "liberation-serif", "liberation-sans", "noto-sans"] as const;
export type FontKey = (typeof FONTS)[number];

/** Free fonts with the same letter widths as the ones the old labels use. */
export const FONT_NAMES: Record<FontKey, string> = {
	cambria: "Cambria (Caladea)",
	"liberation-serif": "Liberation Serif (Tinos)",
	"liberation-sans": "Liberation Sans (Arimo)",
	"noto-sans": "Noto Sans",
};

/** Picks our font for a font family named in a file. */
export const fontFor = (family: string): FontKey => {
	const f = family.toLowerCase();
	if (f.includes("cambria") || f.includes("caladea")) return "cambria";
	if (f.includes("noto")) return "noto-sans";
	if (/sans|arial|helvetica|aptos|calibri|arimo|inter/.test(f)) return "liberation-sans";
	return "liberation-serif";
};

export const PLACED_LIMITS = {
	positionMm: { min: -100, max: 400 },
	sizeMm: { min: 0, max: 400 },
	textPt: { min: 2, max: 200 },
	parts: 400,
	runs: 40,
	paragraphs: 60,
	textLength: 300,
	pathLength: 50_000,
} as const;

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const position = z.number().min(PLACED_LIMITS.positionMm.min).max(PLACED_LIMITS.positionMm.max);
const size = z.number().min(PLACED_LIMITS.sizeMm.min).max(PLACED_LIMITS.sizeMm.max);
const fraction = z.number().min(0).max(1);
const visible = z.unknown().optional().transform((v) => v !== false);

/** Where a part sits: its top-left corner, size, and a turn about that corner (clockwise). */
const box = {
	id: z.string().min(1, { error: "needs its own id." }),
	xMm: position,
	yMm: position,
	wMm: size,
	hMm: size,
	rotateDeg: z.number().min(-360).max(360).catch(0),
	visible,
};

const runSchema = z.object({
	text: z.string().max(PLACED_LIMITS.textLength, { error: `keep each piece of text under ${PLACED_LIMITS.textLength} characters.` }),
	sizePt: z.number().min(PLACED_LIMITS.textPt.min).max(PLACED_LIMITS.textPt.max),
	weight: z.union([z.literal(400), z.literal(700)]).catch(700),
	italic: z.boolean().catch(false),
	font: z.enum(FONTS).catch("cambria"),
	color: color.catch("#000000"),
});

const paragraphSchema = z.object({
	align: z.enum(["left", "center", "right"]).catch("left"),
	/** Height of the line when it has no text. */
	sizePt: z.number().min(PLACED_LIMITS.textPt.min).max(PLACED_LIMITS.textPt.max),
	runs: z.array(runSchema).max(PLACED_LIMITS.runs),
});

const placedTextSchema = z.object({
	...box,
	kind: z.literal("text"),
	/** Where the block of text sits inside the box. */
	hAlign: z.enum(["left", "center", "right"]).catch("left"),
	vAlign: z.enum(["top", "middle", "bottom"]).catch("top"),
	/** Fixed-width boxes wrap; boxes that grow with their text don't. */
	wrap: z.boolean().catch(false),
	/** Top, right, bottom, left. */
	paddingMm: z.tuple([size, size, size, size]).catch([0, 0, 0, 0]),
	paragraphs: z.array(paragraphSchema).max(PLACED_LIMITS.paragraphs),
});

const placedImageSchema = z.object({
	...box,
	kind: z.literal("image"),
	/** SHA-256 of the picture in label_images; null when it couldn't be kept (e.g. a PDF picture). */
	image: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
	/** What a barcode reader found in the picture, if it's a barcode. */
	scanned: z.string().max(100).nullable().catch(null),
	/** Share of the picture cut from each edge (top, right, bottom, left); the rest fills the box. */
	crop: z
		.tuple([fraction, fraction, fraction, fraction])
		.refine(([t, r, b, l]) => t + b < 1 && l + r < 1, { error: "would cut the whole picture away." })
		.catch([0, 0, 0, 0]),
});

const placedShapeSchema = z.object({
	...box,
	kind: z.literal("shape"),
	viewBox: z.tuple([z.number().positive(), z.number().positive()]),
	/** An SVG path in viewBox units: only path commands and numbers. */
	d: z
		.string()
		.max(PLACED_LIMITS.pathLength)
		.regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$/),
	fill: color.nullable(),
	stroke: color.nullable(),
	/** In viewBox units. */
	strokeWidth: z.number().min(0).max(10_000).catch(0),
});

const placedBarcodeSchema = z.object({
	...box,
	kind: z.literal("barcode"),
	numberSizePt: z.number().min(0).max(40),
});

const placedPartSchema = z.discriminatedUnion("kind", [placedTextSchema, placedImageSchema, placedShapeSchema, placedBarcodeSchema], {
	error: "isn't a text, picture, shape or barcode part.",
});

export const placedDesignSchema = z
	.object({
		layout: z.literal("placed"),
		widthMm: z.number().min(10).max(300),
		heightMm: z.number().min(10).max(300),
		parts: z.array(placedPartSchema).max(PLACED_LIMITS.parts, { error: `A label can have up to ${PLACED_LIMITS.parts} parts.` }),
	})
	.superRefine((design, ctx) => {
		const seen = new Set<string>();
		design.parts.forEach((part, index) => {
			if (seen.has(part.id)) ctx.addIssue({ code: "custom", path: ["parts", index, "id"], message: "needs its own id." });
			seen.add(part.id);
		});
	});

export type PlacedDesign = z.output<typeof placedDesignSchema>;
export type PlacedPart = PlacedDesign["parts"][number];
export type PlacedText = Extract<PlacedPart, { kind: "text" }>;
export type PlacedImage = Extract<PlacedPart, { kind: "image" }>;
export type PlacedShape = Extract<PlacedPart, { kind: "shape" }>;
export type PlacedBarcode = Extract<PlacedPart, { kind: "barcode" }>;
export type Paragraph = PlacedText["paragraphs"][number];
export type Run = Paragraph["runs"][number];

/** The text of a paragraph, its runs joined. */
export const paragraphText = (p: Paragraph) => p.runs.map((r) => r.text).join("");

/** Picture hashes a design uses, so they can be checked or fetched. */
export const imagesUsed = (design: PlacedDesign): string[] => [
	...new Set(design.parts.flatMap((p) => (p.kind === "image" && p.image ? [p.image] : []))),
];

/** Parts that reach outside the label (after their box, rotation ignored). */
export const partsOutside = (design: PlacedDesign): string[] =>
	design.parts
		.filter((p) => p.visible && p.rotateDeg === 0)
		.filter((p) => p.xMm < -0.5 || p.yMm < -0.5 || p.xMm + p.wMm > design.widthMm + 0.5 || p.yMm + p.hMm > design.heightMm + 0.5)
		.map((p) => p.id);
