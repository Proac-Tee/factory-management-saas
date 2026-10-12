// Turns a LibreOffice Draw label (.odg) into a label for the studio. The
// script in scripts/import-labels.mts reads the file into OdgItems; the rules
// for naming, grouping and stacking the parts live here so they're tested.

import { checkGtin } from "./gtin";
import {
	checkFit,
	type LabelDesign,
	type LabelKind,
	type LabelPart,
	LIMITS,
	type Storage,
} from "./label";

/** A text box or picture on the drawing, in mm from the top left. */
export type OdgItem =
	| { kind: "text"; xMm: number; yMm: number; widthMm: number; lines: { text: string; sizePt: number }[] }
	| { kind: "image"; xMm: number; yMm: number; widthMm: number; heightMm: number };

export type ImportedLabel = {
	name: string;
	customer: string;
	kind: LabelKind;
	sku: string | null;
	storage: Storage | null;
	barcode: string | null;
	design: LabelDesign;
};

// ─── Grouping, from where the file sits ──────────────────────────────────────

const CUSTOMERS: [RegExp, string][] = [
	[/AMAZON\/AMAZON EU/i, "Amazon EU"],
	[/AMAZON\/AMAZON UK/i, "Amazon UK"],
	[/^AMAZON/i, "Amazon UK"],
	[/^LENHAMS/i, "Lenhams"],
	[/^CULINA/i, "Culina"],
	[/^CODESTORM/i, "Codestorm"],
	[/^PRIMEBITE/i, "Primebite"],
	[/TESCO/i, "Tesco"],
	[/ALLIANCE/i, "Alliance"],
];

export const customerFor = (path: string): string => {
	// Tesco and Alliance labels sit in other customers' folders, so check the
	// file name before the folder.
	const file = path.split("/").at(-1) ?? path;
	if (/TESCO/i.test(file)) return "Tesco";
	if (/ALLIANCE/i.test(file)) return "Alliance";
	return CUSTOMERS.find(([pattern]) => pattern.test(path))?.[1] ?? "Ember";
};

export const kindFor = (path: string): LabelKind => {
	const p = path.toUpperCase();
	if (/BARCODE/.test(p) && !/SRP|SHIPPER|PALLET/.test(p.split("/").at(-1) ?? "")) return "barcode";
	if (/HOLD/.test(p)) return "hold";
	if (/WASTE|UNDERS|OVERS|TARE/.test(p)) return "waste";
	if (/SAMPLE/.test(p)) return "sample";
	if (/ADDRESS|POST OFFICE|HEAVY PARCEL/.test(p)) return "address";
	if (/PALLET/.test(p)) return "pallet";
	if (/SHIPPER/.test(p)) return "shipper";
	if (/SRP|PAN EU|CLIPSTRIP|BAG LABEL|BILTONG \d|BILTONT/.test(p)) return "srp";
	return "other";
};

const KEEP_UPPER = new Set(["SRP", "UK", "EU", "PAN", "BBE", "SKU", "INQ", "BP", "DM", "XW", "TT", "O2", "AW", "MISC"]);

/** "ORIGINAL BILTONG 45g  SRP LABEL 10145" → "Original Biltong 45g SRP 10145" */
export const nameFor = (path: string): string => {
	const segments = path.split("/");
	let file = (segments.at(-1) ?? path).replace(/\.odg$/i, "");
	// "LABEL 3" says nothing on its own; take the folder's name too.
	if (!/[A-Z]{2,}/i.test(file.replace(/\bLABEL\b/gi, "")) && segments.length > 1) {
		file = `${segments.at(-2)} ${file}`;
	}
	return file
		.replace(/\s*\(\d+\)\s*$/, "") // "(1)" copies
		.replace(/\s*-\s*Copy$/i, "")
		.replace(/\bLABEL\b/gi, " ")
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => {
			if (/\d/.test(word) || KEEP_UPPER.has(word.toUpperCase()) || word === "-" || word === "&") return word;
			if (word === word.toUpperCase()) return word[0] + word.slice(1).toLowerCase();
			return word;
		})
		.join(" ")
		.replace(/\s+-\s+$/, "")
		.slice(0, 80)
		.trim();
};

/** Words that name the pack level, not the product. */
const PACK_LEVEL_WORDS = /\b(SRP|SHIPPER|PALLET|CASE|LABELS?)\b/gi;

/**
 * The product a label is for, from the label's name: "Original Biltong 45g
 * SRP 10145" → "Original Biltong 45g". The same rule backfills products in
 * drizzle/0005_*.sql; editors can rename a product afterwards.
 */
export const productNameFor = (labelName: string, sku: string): string => {
	const escaped = sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const name = labelName
		.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ")
		.replace(PACK_LEVEL_WORDS, " ")
		.replace(/\s+/g, " ")
		.replace(/^[\s-]+|[\s-]+$/g, "")
		.slice(0, 60)
		.trim();
	return name || `Product ${sku}`;
};


// ─── Details read from the text ──────────────────────────────────────────────

const SKU_IN_TEXT = /SKU:?\s*([A-Z0-9-]{3,20})/i;
const SKU_IN_NAME = /\b(\d{5,9}[A-Z]{0,3})\b/;

export const skuFor = (path: string, texts: string[]): string | null => {
	for (const text of texts) {
		const match = SKU_IN_TEXT.exec(text);
		if (match) return match[1].toUpperCase();
	}
	const match = SKU_IN_NAME.exec(path.split("/").at(-1) ?? "");
	return match ? match[1].toUpperCase() : null;
};

export const storageFor = (texts: string[]): Storage | null => {
	const all = texts.join(" ").toUpperCase();
	if (/\bCHILLED\b/.test(all)) return "chilled";
	if (/\bAMBIENT\b/.test(all)) return "ambient";
	return null;
};

/** Batch, BBE and quantity values on the old labels were typed in; make them fields. */
export const withFields = (text: string): string =>
	text
		.replace(/(BATCH:)\s*[A-Z0-9]+/i, "$1 {batch}")
		.replace(/(BBE:)\s*[0-9]{1,3}[ .][0-9]{2}[ .][0-9]{2}/i, "$1 {bbe}")
		.replace(/(QTY:)\s*[0-9]+/i, "$1 {qty}");

// ─── Stacking ────────────────────────────────────────────────────────────────

type Row = { yMm: number; sizePt: number; texts: { xMm: number; text: string }[] };

/**
 * The old labels place boxes freely. The studio stacks parts, so boxes on the
 * same line (e.g. BATCH on the left, BBE on the right) join into one line,
 * then everything is ordered top to bottom.
 */
export const toDesign = (
	page: { widthMm: number; heightMm: number },
	items: OdgItem[],
): { design: LabelDesign; barcodeFromText: string | null } => {
	const rows: Row[] = [];
	const blocks: { yMm: number; part: LabelPart }[] = [];
	let barcodeFromText: string | null = null;
	let barcodeNumberPt = 0;

	for (const item of items) {
		if (item.kind === "image") {
			// Wide pictures are barcodes; anything squarer is the logo.
			const isBarcode = item.widthMm / item.heightMm >= 1.8;
			blocks.push({
				yMm: item.yMm,
				part: isBarcode
					? { id: "", kind: "barcode", heightMm: clamp(item.heightMm * 0.78, LIMITS.blockMm), numberSizePt: 10, visible: true }
					: { id: "", kind: "logo", heightMm: clamp(item.heightMm * 0.7, LIMITS.blockMm), visible: true },
			});
			continue;
		}
		let yMm = item.yMm;
		for (const line of item.lines) {
			const text = line.text.replace(/\s+/g, " ").trim();
			const lineMm = line.sizePt * 0.3528 * 1.15;
			if (text !== "") {
				const digits = text.replace(/\s/g, "");
				const gtin = /^\d{13,14}$/.test(digits) ? checkGtin(digits) : null;
				if (gtin?.ok) {
					barcodeFromText = gtin.gtin;
					barcodeNumberPt = line.sizePt;
				} else {
					const row = rows.find((r) => Math.abs(r.yMm - yMm) < 2.5);
					if (row) {
						row.texts.push({ xMm: item.xMm, text });
						row.sizePt = Math.max(row.sizePt, line.sizePt);
					} else {
						rows.push({ yMm, sizePt: line.sizePt, texts: [{ xMm: item.xMm, text }] });
					}
				}
			}
			yMm += lineMm;
		}
	}

	const textParts = rows.map((row) => ({
		yMm: row.yMm,
		part: {
			id: "",
			kind: "text",
			text: withFields(
				row.texts
					.sort((a, b) => a.xMm - b.xMm)
					.map((t) => t.text)
					.join("   "),
			).slice(0, LIMITS.textLength),
			sizePt: clamp(row.sizePt, LIMITS.textPt),
			weight: row.sizePt >= 18 ? 900 : 700,
			align: "center",
			visible: true,
		} satisfies LabelPart,
	}));

	// A barcode number printed as text goes under the barcode, not as a line.
	if (barcodeFromText && barcodeNumberPt > 0) {
		const barcode = blocks.find((b) => b.part.kind === "barcode");
		if (barcode && barcode.part.kind === "barcode") barcode.part.numberSizePt = clamp(barcodeNumberPt, LIMITS.numberPt);
	}

	const parts = [...blocks, ...textParts]
		.sort((a, b) => a.yMm - b.yMm)
		.map(({ part }, index) => ({ ...part, id: `p${index + 1}` }));

	const small = Math.min(page.widthMm, page.heightMm) < 40;
	const design: LabelDesign = {
		widthMm: round1(page.widthMm),
		heightMm: round1(page.heightMm),
		marginMm: small ? 1.5 : 3,
		gapMm: small ? 0.5 : 1,
		parts: parts.slice(0, LIMITS.parts),
	};
	return { design: shrinkToFit(design), barcodeFromText };
};

/**
 * Freely placed boxes can add up to more than the label once stacked. Close
 * the gaps first, then scale every part down together until it fits.
 */
export const shrinkToFit = (design: LabelDesign): LabelDesign => {
	let result = design;
	if (!checkFit(result).fits) result = { ...result, gapMm: 0 };
	for (let i = 0; i < 40 && !checkFit(result).fits; i++) {
		result = {
			...result,
			parts: result.parts.map((part) => {
				if (part.kind === "text") return { ...part, sizePt: Math.max(LIMITS.textPt.min, round1(part.sizePt * 0.95)) };
				if (part.kind === "barcode") {
					return {
						...part,
						heightMm: Math.max(LIMITS.blockMm.min, round1(part.heightMm * 0.95)),
						numberSizePt: round1(part.numberSizePt * 0.95),
					};
				}
				return { ...part, heightMm: Math.max(LIMITS.blockMm.min, round1(part.heightMm * 0.95)) };
			}),
		};
	}
	return result;
};

export const importLabel = (
	path: string,
	page: { widthMm: number; heightMm: number },
	items: OdgItem[],
): ImportedLabel => {
	const texts = items.flatMap((i) => (i.kind === "text" ? i.lines.map((l) => l.text) : []));
	const { design, barcodeFromText } = toDesign(page, items);
	return {
		name: nameFor(path),
		customer: customerFor(path),
		kind: kindFor(path),
		sku: skuFor(path, texts),
		storage: storageFor(texts),
		barcode: barcodeFromText,
		design,
	};
};

const clamp = (n: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, round1(n)));
const round1 = (n: number) => Math.round(n * 10) / 10;
