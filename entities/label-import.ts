// Turns a LibreOffice Draw label (.odg) into a label for the studio, laid out
// exactly as drawn (a "placed" design). entities/odg.ts reads the file; the
// rules for naming, grouping and finding the barcode live here, tested.

import { readBars } from "./barcode-read";
import { checkGtin } from "./gtin";
import type { LabelKind, Storage } from "./label";
import { imageSizeMm } from "./image-size";
import type { OdgDocument, OdgItem } from "./odg";
import type { PlacedDesign, PlacedPart } from "./placed";

/**
 * The product number (GTIN) in what a barcode reader returned, or null if
 * it holds none. EAN-13 and ITF-14 are the number itself; GS1-128 and
 * DataBar carry it after the (01) application identifier; UPC-A is a
 * GTIN-13 with a leading 0. Amazon FNSKUs and pallet SSCCs (00) aren't
 * product numbers.
 */
export const gtinFromScan = (text: string): string | null => {
	const ai01 = /\(01\)(\d{14})/.exec(text) ?? /^\]?[A-Za-z]?\d?01(\d{14})/.exec(text.replace(/[\s\x1d]/g, ""));
	const digits = ai01 ? ai01[1] : text.replace(/\s+/g, "");
	const candidate = /^\d{12}$/.test(digits) ? `0${digits}` : digits;
	if (!/^\d{13,14}$/.test(candidate)) return null;
	const check = checkGtin(candidate);
	return check.ok ? check.gtin : null;
};

export type ImportedLabel = {
	/** Where the file sits, e.g. ["LENHAMS", "BILTONG LABELS", "SRP LABELS"]. */
	folderPath: string[];
	sourceFile: string;
	name: string;
	customer: string;
	kind: LabelKind;
	sku: string | null;
	storage: Storage | null;
	barcode: string | null;
	design: PlacedDesign;
	/** What couldn't be carried over, in plain words. */
	warnings: string[];
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
	const segments = path.split("/");
	const file = segments.at(-1) ?? path;
	if (/TESCO/i.test(file)) return "Tesco";
	if (/ALLIANCE/i.test(file)) return "Alliance";
	// The customer's folder may sit inside another ("Label Designs/LENHAMS/…").
	for (let i = 0; i < segments.length - 1; i++) {
		const from = segments.slice(i).join("/");
		const found = CUSTOMERS.find(([pattern]) => pattern.test(from));
		if (found) return found[1];
	}
	return "Ember";
};

/**
 * Files in a dropped folder that aren't labels: LibreOffice lock files,
 * Windows and Mac leftovers, shortcuts and archives. Only .odg files are read.
 */
export const fileToSkip = (path: string): string | null => {
	const name = path.split("/").at(-1) ?? path;
	if (path.split("/").some((s) => s.startsWith(".") || s === "__MACOSX")) return "a hidden or system file";
	if (/^(\.~lock\.|~\$|~)/.test(name)) return "a LibreOffice lock file";
	if (/^(desktop\.ini|thumbs\.db)$/i.test(name)) return "a Windows file";
	if (/\.lnk$/i.test(name)) return "a shortcut";
	if (/\.(zip|rar|7z)$/i.test(name)) return "an archive; unzip it first";
	if (!/\.odg$/i.test(name)) return "not a LibreOffice Draw file (.odg)";
	return null;
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

// ─── Placing ─────────────────────────────────────────────────────────────────

/** What the caller found out about each picture in the file (by its path). */
export type PictureInfo = Record<
	string,
	{
		/** SHA-256 of the picture as stored, or null if it can't be shown (PDF, SVM…). */
		hash: string | null;
		/** Text a barcode reader found in it, if any. */
		scanned: string | null;
	}
>;

/** Picture types browsers draw; anything else is left out with a warning. */
export const SHOWABLE_PICTURE = /\.(png|jpe?g|gif|webp)$/i;

/**
 * Bars drawn as filled rectangles: the largest group of rectangles that
 * share a top and a height (the frame around an ITF-14 doesn't).
 */
const barsDrawnAsShapes = (items: OdgItem[]) => {
	const groups = new Map<string, { x: number; width: number }[]>();
	for (const item of items) {
		if (item.kind !== "shape" || !item.fill || item.rotateDeg !== 0 || item.wMm <= 0) continue;
		if (!/^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+){3} Z$/.test(item.d)) continue;
		const key = `${item.yMm.toFixed(2)}:${item.hMm.toFixed(2)}`;
		groups.set(key, [...(groups.get(key) ?? []), { x: item.xMm, width: item.wMm }]);
	}
	return [...groups.values()].sort((a, b) => b.length - a.length);
};

const findBarcode = (doc: OdgDocument, pictures: PictureInfo, texts: string[]): string | null => {
	for (const item of doc.items) {
		const scanned = item.kind === "image" ? pictures[item.href]?.scanned : null;
		const gtin = scanned ? gtinFromScan(scanned) : null;
		if (gtin) return gtin;
	}
	for (const bars of barsDrawnAsShapes(doc.items)) {
		const gtin = readBars(bars);
		if (gtin) return gtin;
	}
	for (const text of texts) {
		const digits = text.replace(/\s/g, "");
		if (/^\d{13,14}$/.test(digits) && checkGtin(digits).ok) return digits;
	}
	return null;
};

/** A crop in mm of the picture's natural size, as shares of each side. */
const cropOf = (cropMm: [number, number, number, number], bytes: Uint8Array | undefined): [number, number, number, number] => {
	if (cropMm.every((v) => v === 0) || !bytes) return [0, 0, 0, 0];
	const size = imageSizeMm(bytes);
	if (!size) return [0, 0, 0, 0];
	const [t, r, b, l] = cropMm;
	const share = (v: number, of: number) => Math.min(0.95, v / of);
	const crop: [number, number, number, number] = [share(t, size.heightMm), share(r, size.widthMm), share(b, size.heightMm), share(l, size.widthMm)];
	return crop[0] + crop[2] < 1 && crop[1] + crop[3] < 1 ? crop : [0, 0, 0, 0];
};

/** The label for one file: its place in the folders, its details, and every part where it was drawn. */
export const importLabel = (path: string, doc: OdgDocument, pictures: PictureInfo): ImportedLabel => {
	const warnings = [...doc.warnings];
	const texts = doc.items.flatMap((i) => (i.kind === "text" ? i.paragraphs.map((p) => p.runs.map((r) => r.text).join("")) : []));
	const parts: PlacedPart[] = doc.items.map((item, index): PlacedPart => {
		const id = `p${index + 1}`;
		const { xMm, yMm, wMm, hMm, rotateDeg } = item;
		const box = { id, xMm, yMm, wMm, hMm, rotateDeg, visible: true };
		if (item.kind === "text") {
			return {
				...box,
				kind: "text",
				hAlign: item.hAlign,
				vAlign: item.vAlign,
				wrap: item.wrap,
				paddingMm: item.paddingMm,
				paragraphs: item.paragraphs.map((p) => ({
					...p,
					// Batch, BBE and quantity were typed in; make them fields filled in at print time.
					runs: p.runs.map((r) => ({ ...r, text: withFields(r.text) })),
				})),
			};
		}
		if (item.kind === "image") {
			const info = pictures[item.href];
			const hash = SHOWABLE_PICTURE.test(item.href) ? (info?.hash ?? null) : null;
			if (!hash) warnings.push(`A picture (${item.href.split(".").at(-1)?.toUpperCase() ?? "?"}) can't be shown, so it's left blank.`);
			return { ...box, kind: "image", image: hash, scanned: info?.scanned ?? null, crop: cropOf(item.cropMm, doc.pictures[item.href]) };
		}
		return { ...box, kind: "shape", viewBox: item.viewBox, d: item.d, fill: item.fill, stroke: item.stroke, strokeWidth: item.strokeWidth };
	});

	return {
		folderPath: path.split("/").slice(0, -1),
		sourceFile: path,
		name: nameFor(path),
		customer: customerFor(path),
		kind: kindFor(path),
		sku: skuFor(path, texts),
		storage: storageFor(texts),
		barcode: findBarcode(doc, pictures, texts),
		design: { layout: "placed", widthMm: doc.page.widthMm, heightMm: doc.page.heightMm, parts },
		warnings: [...new Set(warnings)],
	};
};
