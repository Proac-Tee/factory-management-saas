// Imports the LibreOffice Draw labels (.odg) into the label studio.
//
//   pnpm labels:import "/path/to/Label Designs"            (adds new files only)
//   pnpm labels:import "/path/to/Label Designs" --replace  (also re-imports
//                                                           files already in)
//   pnpm labels:import "/path/to/Label Designs" --dry-run  (prints, saves nothing)
//
// Runs as the database owner (DATABASE_URL), so it's for an admin on their
// own machine. Labels are matched on their path inside the folder, so running
// it again is safe.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";
import postgres from "postgres";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { z } from "zod";
import { checkDetails, parseDesign } from "../entities/label";
import { gtinFromScan, importLabel, isBarcodePicture, type OdgItem, productNameFor } from "../entities/label-import";
import { databaseUrl } from "../lib/env";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { replace: { type: "boolean" }, "dry-run": { type: "boolean" } },
});
const folder = z
	.string({ error: 'Give the folder: pnpm labels:import "/path/to/Label Designs"' })
	.refine((path) => existsSync(path) && statSync(path).isDirectory(), { error: "That folder doesn't exist." })
	.safeParse(positionals[0]);
if (!folder.success) {
	console.error(folder.error.issues[0].message);
	process.exit(1);
}
const root = folder.data;

// ─── Reading an .odg ─────────────────────────────────────────────────────────

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", preserveOrder: true, trimValues: false });
type Node = Record<string, unknown> & { ":@"?: Record<string, string> };

const tagOf = (node: Node) => Object.keys(node).find((k) => k !== ":@")!;
const childrenOf = (node: Node) => (node[tagOf(node)] as Node[]) ?? [];
const attr = (node: Node, name: string) => node[":@"]?.[`@${name}`];

const toMm = (value: string | undefined): number => {
	const match = /^(-?[\d.]+)(mm|cm|in|pt)$/.exec(value ?? "");
	if (!match) return 0;
	return Number(match[1]) * { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72 }[match[2] as "mm"];
};

/** style name → font size in pt, from every style:style in the file. */
const fontSizes = (xmls: Node[][]): Map<string, number> => {
	const sizes = new Map<string, number>();
	const parents = new Map<string, string>();
	const walk = (nodes: Node[]) => {
		for (const node of nodes) {
			const tag = tagOf(node);
			if (tag === "style:style" || tag === "style:default-style") {
				const name = attr(node, "style:name") ?? `default:${attr(node, "style:family")}`;
				const parent = attr(node, "style:parent-style-name");
				if (parent) parents.set(name, parent);
				for (const child of childrenOf(node)) {
					const size = attr(child, "fo:font-size");
					if (tagOf(child) === "style:text-properties" && size?.endsWith("pt")) sizes.set(name, Number.parseFloat(size));
				}
			}
			if (tag !== "#text") walk(childrenOf(node));
		}
	};
	xmls.forEach(walk);
	// Fill in inherited sizes.
	for (const [name, parent] of parents) {
		if (sizes.has(name)) continue;
		let p: string | undefined = parent;
		while (p && !sizes.has(p)) p = parents.get(p);
		if (p) sizes.set(name, sizes.get(p)!);
	}
	return sizes;
};

const textOf = (node: Node): string => {
	const tag = tagOf(node);
	if (tag === "#text") return String(node["#text"]);
	if (tag === "text:s") return " ".repeat(Number(attr(node, "text:c") ?? 1));
	if (tag === "text:tab") return " ";
	return childrenOf(node).map(textOf).join("");
};

/** The size of a paragraph: its first sized span, else its style, else the box's. */
const sizeOf = (p: Node, sizes: Map<string, number>, fallback: number): number => {
	const spanSizes: number[] = [];
	const walk = (nodes: Node[]) => {
		for (const n of nodes) {
			const style = attr(n, "text:style-name");
			if (tagOf(n) === "text:span" && style && sizes.has(style) && textOf(n).trim() !== "") spanSizes.push(sizes.get(style)!);
			if (tagOf(n) !== "#text") walk(childrenOf(n));
		}
	};
	walk(childrenOf(p));
	if (spanSizes.length) return Math.max(...spanSizes);
	const pStyle = attr(p, "text:style-name");
	return (pStyle && sizes.get(pStyle)) || fallback;
};

const readOdg = (path: string) => {
	const files = unzipSync(new Uint8Array(readFileSync(path)), {
		filter: (file) => file.name === "content.xml" || file.name === "styles.xml" || file.name.startsWith("Pictures/"),
	});
	const decode = (name: string) => parser.parse(new TextDecoder().decode(files[name])) as Node[];
	const content = decode("content.xml");
	const styles = decode("styles.xml");
	const sizes = fontSizes([styles, content]);
	const defaultSize = sizes.get("default:graphic") ?? 18;

	let page = { widthMm: 100, heightMm: 100 };
	const findLayout = (nodes: Node[]) => {
		for (const n of nodes) {
			if (tagOf(n) === "style:page-layout-properties" && attr(n, "fo:page-width")) {
				page = { widthMm: toMm(attr(n, "fo:page-width")), heightMm: toMm(attr(n, "fo:page-height")) };
				return;
			}
			if (tagOf(n) !== "#text") findLayout(childrenOf(n));
		}
	};
	findLayout(styles);

	const items: OdgItem[] = [];
	const pictures: Picture[] = [];
	const findFirstPage = (nodes: Node[]): Node | null => {
		for (const n of nodes) {
			if (tagOf(n) === "draw:page") return n;
			if (tagOf(n) !== "#text") {
				const found = findFirstPage(childrenOf(n));
				if (found) return found;
			}
		}
		return null;
	};
	const firstPage = findFirstPage(content);

	const visit = (nodes: Node[], offsetX = 0, offsetY = 0) => {
		for (const n of nodes) {
			const tag = tagOf(n);
			if (tag === "#text") continue;
			const xMm = offsetX + toMm(attr(n, "svg:x"));
			const yMm = offsetY + toMm(attr(n, "svg:y"));
			const widthMm = toMm(attr(n, "svg:width"));
			const heightMm = toMm(attr(n, "svg:height"));
			if (tag === "draw:g") {
				visit(childrenOf(n), offsetX, offsetY);
				continue;
			}
			const boxSize =
				sizes.get(attr(n, "draw:text-style-name") ?? "") ?? sizes.get(attr(n, "draw:style-name") ?? "") ?? defaultSize;
			const image = childrenOf(n).find((c) => tagOf(c) === "draw:image");
			if (tag === "draw:frame" && image) {
				if (widthMm > 0 && heightMm > 0) {
					const item: OdgItem = { kind: "image", xMm, yMm, widthMm, heightMm };
					items.push(item);
					pictures.push({ item, href: attr(image, "xlink:href") ?? "" });
				}
				continue;
			}
			const paragraphs: Node[] = [];
			const collect = (ns: Node[]) => {
				for (const c of ns) {
					if (tagOf(c) === "text:p") paragraphs.push(c);
					else if (tagOf(c) !== "#text") collect(childrenOf(c));
				}
			};
			collect(childrenOf(n));
			const lines = paragraphs
				.map((p) => ({ text: textOf(p), sizePt: sizeOf(p, sizes, boxSize) }))
				.filter((l) => l.text.trim() !== "");
			if (lines.length) items.push({ kind: "text", xMm, yMm, widthMm, lines });
		}
	};
	if (firstPage) visit(childrenOf(firstPage));
	return { page, items, pictures, files };
};

// ─── Reading barcode pictures ────────────────────────────────────────────────
// The old labels hold the barcode as a picture, so its number is read from the
// bars with ZXing (the same reader the scan screen uses), from the local wasm.

type Picture = { item: OdgItem & { kind: "image" }; href: string };

const require = createRequire(import.meta.url);
prepareZXingModule({
	overrides: { wasmBinary: readFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm")) },
});

/** Why a barcode picture gave no number, for the summary at the end. */
type Unread =
	| "the picture is a vector drawing (SVG/WMF/EMF), which can't be read"
	| "the picture is linked, not saved inside the file"
	| "no barcode was found in the picture"
	| "the barcode holds no product number (e.g. an Amazon FNSKU or pallet SSCC)";

const READABLE = /\.(png|jpe?g|gif|bmp|tiff?)$/i;

/**
 * Reads each barcode picture in place (item.decoded). Any 1D barcode type,
 * turned or inverted. Returns why one gave no product number, with what was
 * read when it was something else.
 */
const readBarcodePictures = async (
	pictures: Picture[],
	files: Record<string, Uint8Array>,
): Promise<{ reason: Unread; found?: string } | null> => {
	let unread: { reason: Unread; found?: string } | null = null;
	for (const { item, href } of pictures.filter((p) => isBarcodePicture(p.item))) {
		const bytes = files[href];
		if (!bytes) {
			unread ??= { reason: "the picture is linked, not saved inside the file" };
			continue;
		}
		if (!READABLE.test(href)) {
			unread ??= { reason: "the picture is a vector drawing (SVG/WMF/EMF), which can't be read" };
			continue;
		}
		const results = (
			await readBarcodes(bytes, { formats: ["Linear-Codes"], tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 4 })
		).filter((r) => r.isValid);
		const withNumber = results.find((r) => gtinFromScan(r.text));
		item.decoded = withNumber?.text ?? null;
		if (withNumber) continue;
		unread ??= results.length
			? {
					reason: "the barcode holds no product number (e.g. an Amazon FNSKU or pallet SSCC)",
					found: results.map((r) => `${r.format} ${r.text}`).join(", "),
				}
			: { reason: "no barcode was found in the picture" };
	}
	return unread;
};

// ─── Walk the folder ─────────────────────────────────────────────────────────

const odgFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (name.startsWith(".") || name.startsWith("~")) return [];
		if (statSync(path).isDirectory()) return odgFiles(path);
		return name.toLowerCase().endsWith(".odg") ? [path] : [];
	});

const main = async () => {
	const files = odgFiles(root).sort();
	console.log(`Found ${files.length} labels in ${root}`);

	const sql = values["dry-run"] ? null : postgres(databaseUrl(), { prepare: false });

	let added = 0;
	let replaced = 0;
	let skipped = 0;
	const problems: string[] = [];
	const missing = new Map<Unread, string[]>();
	/** barcode → the SKUs of labels carrying it, to catch one number on different products. */
	const skusByBarcode = new Map<string, Map<string, string>>();

	for (const file of files) {
		const source = relative(root, file);
		try {
			const { page, items, pictures, files } = readOdg(file);
			const unread = await readBarcodePictures(pictures, files);
			const label = importLabel(source, page, items);
			if (!label.barcode && unread) {
				const example = unread.found ? `${source}  (read: ${unread.found})` : source;
				missing.set(unread.reason, [...(missing.get(unread.reason) ?? []), example]);
			}
			if (label.barcode && label.sku) {
				const skus = skusByBarcode.get(label.barcode) ?? new Map<string, string>();
				skus.set(label.sku, source);
				skusByBarcode.set(label.barcode, skus);
			}
			const design = parseDesign(label.design);
			if (!design.ok) throw new Error(design.message);
			// The same rules the editor applies, so imported labels can be saved as they are.
			const productName = label.sku ? productNameFor(label.name, label.sku) : "";
			const details = checkDetails({
				...label,
				sku: label.sku ?? "",
				productName,
				storage: label.storage ?? "",
				barcode: label.barcode ?? "",
			});
			if (!details.ok) throw new Error(details.message);

			if (!sql) {
				console.log(
					`${label.customer.padEnd(10)} ${label.kind.padEnd(8)} ${(label.barcode ?? "no barcode").padEnd(14)} ${label.name}  (${design.design.parts.length} parts)`,
				);
				continue;
			}
			const { name, customer, kind, sku, storage, barcode } = details.details;
			const row = { name, customer, kind, sku, storage, barcode, design: sql.json(design.design), source_file: source };
			// A new SKU adds its product; an existing product keeps the name editors gave it.
			if (sku) {
				await sql`insert into public.products (sku, name) values (${sku}, ${productName}) on conflict (sku) do nothing`;
			}
			const [existing] = await sql`select id from public.labels where source_file = ${source}`;
			if (existing && !values.replace) {
				skipped++;
			} else if (existing) {
				await sql`update public.labels set ${sql(row, "name", "customer", "kind", "sku", "storage", "barcode", "design")}, updated_at = now() where id = ${existing.id}`;
				replaced++;
			} else {
				await sql`insert into public.labels ${sql(row)}`;
				added++;
			}
		} catch (error) {
			problems.push(`${source}: ${(error as Error).message}`);
		}
	}

	if (sql) {
		await sql.end();
		console.log(`Added ${added}, re-imported ${replaced}, already there ${skipped}.`);
	}
	const withoutNumber = [...missing.values()].reduce((n, files) => n + files.length, 0);
	console.log(
		withoutNumber === 0
			? "Every barcode picture was read."
			: `\n${withoutNumber === 1 ? "1 label has" : `${withoutNumber} labels have`} a barcode picture but no number yet:`,
	);
	for (const [reason, files] of missing) {
		console.log(`  ${files.length}: ${reason}. For example:`);
		for (const f of files.slice(0, 3)) console.log(`    ${f}`);
	}
	const shared = [...skusByBarcode].filter(([, skus]) => skus.size > 1);
	if (shared.length) {
		console.log(
			`\n${shared.length === 1 ? "1 barcode number is" : `${shared.length} barcode numbers are`} on labels for different SKUs. Check them against your GS1 list:`,
		);
		for (const [barcode, skus] of shared) {
			console.log(`  ${barcode}: SKUs ${[...skus.keys()].join(", ")}`);
		}
	}
	if (problems.length) {
		console.log(`\n${problems.length} couldn't be read:`);
		for (const p of problems) console.log(`  ${p}`);
		process.exitCode = 1;
	}
};

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
