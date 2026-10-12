// Reads a LibreOffice Draw file (.odg) into what's on its first page: text
// boxes with their styled text, pictures, and drawn shapes, all in mm from
// the page's top-left corner. Pure (bytes in, data out), so the browser
// upload and the command-line import share it.

import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";
import { type FontKey, fontFor } from "./placed";

export type Box = { xMm: number; yMm: number; wMm: number; hMm: number; rotateDeg: number };

export type OdgRun = { text: string; sizePt: number; weight: 400 | 700; italic: boolean; font: FontKey; color: string };
export type OdgParagraph = { align: "left" | "center" | "right"; sizePt: number; runs: OdgRun[] };

export type OdgItem =
	| ({
			kind: "text";
			hAlign: "left" | "center" | "right";
			vAlign: "top" | "middle" | "bottom";
			wrap: boolean;
			paddingMm: [number, number, number, number];
			paragraphs: OdgParagraph[];
	  } & Box)
	| ({
			kind: "image";
			href: string;
			mime: string;
			/** Cut from the picture's own edges (top, right, bottom, left), in mm of its natural size. */
			cropMm: [number, number, number, number];
	  } & Box)
	| ({
			kind: "shape";
			viewBox: [number, number];
			d: string;
			fill: string | null;
			stroke: string | null;
			strokeWidth: number;
	  } & Box);

export type OdgDocument = {
	page: { widthMm: number; heightMm: number };
	items: OdgItem[];
	/** Pictures inside the file, by their path (e.g. "Pictures/1000.png"). */
	pictures: Record<string, Uint8Array>;
	/** Things on the page that couldn't be read, in plain words. */
	warnings: string[];
};

/** `rect(2.5cm, 0cm, 0cm, 1cm)` → [25, 0, 0, 10]; "auto" sides are 0. */
export const clipOf = (clip: string | undefined): [number, number, number, number] => {
	const sides = /^rect\((.*)\)$/.exec(clip?.trim() ?? "")?.[1].split(/[,\s]+/).filter(Boolean) ?? [];
	if (sides.length !== 4) return [0, 0, 0, 0];
	const [t, r, b, l] = sides.map((v) => (v === "auto" ? 0 : Math.max(0, toMm(v))));
	return [t, r, b, l];
};

// ─── XML helpers ─────────────────────────────────────────────────────────────

type Node = Record<string, unknown> & { ":@"?: Record<string, string> };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", preserveOrder: true, trimValues: false });

const tagOf = (node: Node) => Object.keys(node).find((k) => k !== ":@") ?? "";
const childrenOf = (node: Node) => (Array.isArray(node[tagOf(node)]) ? (node[tagOf(node)] as Node[]) : []);
const attr = (node: Node, name: string): string | undefined => node[":@"]?.[`@${name}`];
const decodeXml = (s: string) =>
	s.replace(/&(lt|gt|amp|quot|apos);/g, (_, e: string) => ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" })[e] ?? "");

function* walk(nodes: Node[]): Generator<Node> {
	for (const node of nodes) {
		yield node;
		if (tagOf(node) !== "#text") yield* walk(childrenOf(node));
	}
}

/** "1.5cm", "12pt", "0.4in" → mm. */
export const toMm = (value: string | undefined): number => {
	const match = /^(-?[\d.]+)(mm|cm|in|pt|px)?$/.exec(value?.trim() ?? "");
	if (!match) return 0;
	const unit = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 }[(match[2] ?? "mm") as "mm"];
	return Number(match[1]) * unit;
};

const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places;

// ─── Styles ──────────────────────────────────────────────────────────────────
// A style can set graphic, paragraph and text properties and inherit the rest
// from its parent; the document default fills in what nothing sets.

type Props = Record<string, string>;
type Style = { parent?: string; props: Props };

const readStyles = (docs: Node[][]) => {
	const styles = new Map<string, Style>();
	const defaults = new Map<string, Props>();
	const fonts = new Map<string, string>();
	for (const node of docs.flatMap((d) => [...walk(d)])) {
		const tag = tagOf(node);
		if (tag === "style:font-face") {
			const name = attr(node, "style:name");
			const family = attr(node, "svg:font-family");
			if (name && family) fonts.set(name, decodeXml(family).replace(/['"]/g, ""));
			continue;
		}
		if (tag !== "style:style" && tag !== "style:default-style") continue;
		const props: Props = {};
		for (const child of childrenOf(node)) {
			for (const [key, value] of Object.entries(child[":@"] ?? {})) props[key.slice(1)] = value;
		}
		if (tag === "style:default-style") {
			defaults.set(attr(node, "style:family") ?? "", props);
		} else {
			const name = attr(node, "style:name");
			if (name) styles.set(name, { parent: attr(node, "style:parent-style-name"), props });
		}
	}

	/** A property from a style or its parents. */
	const lookup = (name: string | undefined, key: string): string | undefined => {
		for (let s = name ? styles.get(name) : undefined, depth = 0; s && depth < 20; s = s.parent ? styles.get(s.parent) : undefined, depth++) {
			if (s.props[key] !== undefined) return s.props[key];
		}
		return undefined;
	};
	/** The first of several styles (most specific first) that sets the property, else the default. */
	const resolve = (names: (string | undefined)[], key: string, family = "graphic") => {
		for (const name of names) {
			const value = lookup(name, key);
			if (value !== undefined) return value;
		}
		return defaults.get(family)?.[key];
	};
	return { resolve, fonts };
};

type Styles = ReturnType<typeof readStyles>;

const colour = (value: string | undefined, fallback: string | null): string | null =>
	value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;

// ─── Text ────────────────────────────────────────────────────────────────────

const textOf = (node: Node): string => {
	const tag = tagOf(node);
	if (tag === "#text") return decodeXml(String(node["#text"]));
	if (tag === "text:s") return " ".repeat(Number(attr(node, "text:c") ?? 1));
	if (tag === "text:tab") return "\t";
	if (tag === "text:line-break") return "\n";
	return childrenOf(node).map(textOf).join("");
};

const runStyle = (styles: Styles, chain: (string | undefined)[]) => {
	const pick = (key: string) => styles.resolve(chain, key);
	const fontName = pick("style:font-name");
	return {
		sizePt: toMm(pick("fo:font-size") ?? "24pt") / (25.4 / 72),
		weight: pick("fo:font-weight") === "bold" || Number(pick("fo:font-weight")) >= 600 ? 700 : 400,
		italic: pick("fo:font-style") === "italic",
		font: fontFor(styles.fonts.get(fontName ?? "") ?? fontName ?? "Liberation Serif"),
		color: colour(pick("fo:color"), "#000000") ?? "#000000",
	} as const;
};

const alignOf = (value: string | undefined): "left" | "center" | "right" =>
	value === "center" ? "center" : value === "end" || value === "right" ? "right" : "left";

/** The paragraphs of a text box; spans inherit from their paragraph, the box, then the default. */
const readParagraphs = (styles: Styles, box: Node, boxStyles: (string | undefined)[]): OdgParagraph[] => {
	const paragraphs: OdgParagraph[] = [];
	for (const node of walk(childrenOf(box))) {
		if (tagOf(node) !== "text:p" && tagOf(node) !== "text:h") continue;
		const pStyle = attr(node, "text:style-name");
		const base = [pStyle, ...boxStyles];
		const align = alignOf(styles.resolve(base, "fo:text-align"));
		const runs: OdgRun[] = [];
		const visit = (nodes: Node[], chain: (string | undefined)[]) => {
			for (const child of nodes) {
				const tag = tagOf(child);
				if (tag === "text:span") {
					visit(childrenOf(child), [attr(child, "text:style-name"), ...chain]);
				} else {
					const text = textOf(child);
					if (text === "") continue;
					const style = runStyle(styles, chain);
					const last = runs.at(-1);
					// Neighbouring pieces with the same look are one run.
					if (last && last.sizePt === style.sizePt && last.weight === style.weight && last.font === style.font && last.color === style.color && last.italic === style.italic) {
						last.text += text;
					} else {
						runs.push({ text, ...style, sizePt: round(style.sizePt, 2) });
					}
				}
			}
		};
		visit(childrenOf(node), base);
		paragraphs.push({ align, sizePt: round(runStyle(styles, base).sizePt, 2), runs });
	}
	return paragraphs;
};

// ─── Geometry ────────────────────────────────────────────────────────────────

/** Position, size and turn of an element; ODF writes a turned element's place in draw:transform. */
const boxOf = (node: Node, offset: { x: number; y: number }): Box => {
	const wMm = toMm(attr(node, "svg:width"));
	const hMm = toMm(attr(node, "svg:height"));
	let xMm = toMm(attr(node, "svg:x"));
	let yMm = toMm(attr(node, "svg:y"));
	let rotateDeg = 0;
	const transform = attr(node, "draw:transform");
	if (transform) {
		const rotate = /rotate\s*\(\s*(-?[\d.e-]+)\s*\)/.exec(transform);
		const translate = /translate\s*\(\s*(-?[\d.]+\w*)\s+(-?[\d.]+\w*)\s*\)/.exec(transform);
		// ODF turns anticlockwise in radians; CSS turns clockwise in degrees.
		if (rotate) rotateDeg = round((-Number(rotate[1]) * 180) / Math.PI, 2);
		if (translate) {
			xMm = toMm(translate[1]);
			yMm = toMm(translate[2]);
		}
	}
	return { xMm: round(xMm + offset.x), yMm: round(yMm + offset.y), wMm: round(wMm), hMm: round(hMm), rotateDeg };
};

const shapeLook = (styles: Styles, node: Node) => {
	const chain = [attr(node, "draw:style-name")];
	const fill = styles.resolve(chain, "draw:fill") ?? "solid";
	const stroke = styles.resolve(chain, "draw:stroke") ?? "solid";
	return {
		fill: fill === "none" ? null : colour(styles.resolve(chain, "draw:fill-color"), "#000000"),
		stroke: stroke === "none" ? null : colour(styles.resolve(chain, "svg:stroke-color"), "#000000"),
		strokeMm: toMm(styles.resolve(chain, "svg:stroke-width") ?? "0"),
	};
};

const viewBoxOf = (node: Node, box: Box): [number, number] => {
	const parts = (attr(node, "svg:viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
	return parts.length === 4 && parts[2] > 0 && parts[3] > 0 ? [parts[2], parts[3]] : [Math.max(box.wMm, 0.001), Math.max(box.hMm, 0.001)];
};

// ─── The page ────────────────────────────────────────────────────────────────

export const readOdg = (bytes: Uint8Array): OdgDocument => {
	const files = unzipSync(bytes, {
		filter: (file) => file.name === "content.xml" || file.name === "styles.xml" || file.name.startsWith("Pictures/"),
	});
	if (!files["content.xml"]) throw new Error("This isn't a LibreOffice Draw file (no content.xml).");
	const decode = (name: string) => (files[name] ? (parser.parse(new TextDecoder().decode(files[name])) as Node[]) : []);
	const content = decode("content.xml");
	const stylesXml = decode("styles.xml");
	const styles = readStyles([stylesXml, content]);
	const warnings: string[] = [];

	let page = { widthMm: 100, heightMm: 100 };
	for (const node of walk(stylesXml)) {
		if (tagOf(node) === "style:page-layout-properties" && attr(node, "fo:page-width")) {
			page = { widthMm: round(toMm(attr(node, "fo:page-width"))), heightMm: round(toMm(attr(node, "fo:page-height"))) };
			break;
		}
	}

	const firstPage = [...walk(content)].find((n) => tagOf(n) === "draw:page");
	const items: OdgItem[] = [];
	const visit = (nodes: Node[], offset: { x: number; y: number }) => {
		for (const node of nodes) {
			const tag = tagOf(node);
			if (tag === "#text" || tag === "officeooo:annotation" || tag.endsWith(":annotation")) continue;
			if (tag === "draw:g") {
				visit(childrenOf(node), offset);
				continue;
			}
			const box = boxOf(node, offset);
			const graphic = attr(node, "draw:style-name");
			const textStyle = attr(node, "draw:text-style-name");

			if (tag === "draw:frame") {
				const image = childrenOf(node).find((c) => tagOf(c) === "draw:image");
				const textBox = childrenOf(node).find((c) => tagOf(c) === "draw:text-box");
				if (image) {
					const href = attr(image, "xlink:href") ?? "";
					if (!files[href]) warnings.push(`A picture is linked from outside the file (${href || "no name"}), so it can't be shown.`);
					items.push({ kind: "image", ...box, href, mime: attr(image, "draw:mime-type") ?? "", cropMm: clipOf(styles.resolve([graphic], "fo:clip")) });
				} else if (textBox) {
					items.push(textItem(styles, textBox, box, graphic, textStyle));
				} else if (childrenOf(node).some((c) => tagOf(c) === "table:table")) {
					warnings.push("A table can't be shown yet; it's left out.");
				}
			} else if (tag === "draw:polygon" || tag === "draw:polyline") {
				const points = (attr(node, "draw:points") ?? "").trim().split(/\s+/);
				const d = `M${points.join(" L")}${tag === "draw:polygon" ? " Z" : ""}`;
				const look = shapeLook(styles, node);
				const viewBox = viewBoxOf(node, box);
				items.push({ kind: "shape", ...box, viewBox, d, fill: tag === "draw:polygon" ? look.fill : null, stroke: look.stroke, strokeWidth: (look.strokeMm * viewBox[0]) / Math.max(box.wMm, 0.001) });
			} else if (tag === "draw:path") {
				const look = shapeLook(styles, node);
				const viewBox = viewBoxOf(node, box);
				items.push({ kind: "shape", ...box, viewBox, d: attr(node, "svg:d") ?? "", fill: look.fill, stroke: look.stroke, strokeWidth: (look.strokeMm * viewBox[0]) / Math.max(box.wMm, 0.001) });
			} else if (tag === "draw:line") {
				const x1 = toMm(attr(node, "svg:x1")) + offset.x;
				const y1 = toMm(attr(node, "svg:y1")) + offset.y;
				const x2 = toMm(attr(node, "svg:x2")) + offset.x;
				const y2 = toMm(attr(node, "svg:y2")) + offset.y;
				const look = shapeLook(styles, node);
				const x = Math.min(x1, x2);
				const y = Math.min(y1, y2);
				// The box is in mm and so is the path, so the stroke width is in mm too.
				const w = Math.max(Math.abs(x2 - x1), 0.001);
				const h = Math.max(Math.abs(y2 - y1), 0.001);
				items.push({
					kind: "shape",
					xMm: round(x),
					yMm: round(y),
					wMm: round(w),
					hMm: round(h),
					rotateDeg: 0,
					viewBox: [w, h],
					d: `M${round(x1 - x)} ${round(y1 - y)} L${round(x2 - x)} ${round(y2 - y)}`,
					fill: null,
					stroke: look.stroke ?? "#000000",
					strokeWidth: Math.max(look.strokeMm, 0.1),
				});
			} else if (tag === "draw:rect" || tag === "draw:custom-shape" || tag === "draw:ellipse") {
				const look = shapeLook(styles, node);
				const [w, h] = [Math.max(box.wMm, 0.001), Math.max(box.hMm, 0.001)];
				const d =
					tag === "draw:ellipse"
						? `M0 ${h / 2} A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2} A${w / 2} ${h / 2} 0 1 0 0 ${h / 2} Z`
						: `M0 0 L${w} 0 L${w} ${h} L0 ${h} Z`;
				if (tag === "draw:custom-shape") warnings.push("A drawn shape is shown as a plain rectangle.");
				items.push({ kind: "shape", ...box, viewBox: [w, h], d, fill: look.fill, stroke: look.stroke, strokeWidth: look.strokeMm });
				const paragraphs = readParagraphs(styles, node, [textStyle, graphic]);
				if (paragraphs.some((p) => p.runs.length)) items.push(textItem(styles, node, box, graphic, textStyle, "center", "middle"));
			} else if (tag.startsWith("draw:")) {
				warnings.push(`Something on the page (${tag.slice(5)}) can't be shown yet.`);
			}
		}
	};
	if (firstPage) visit(childrenOf(firstPage), { x: 0, y: 0 });

	const pictures: Record<string, Uint8Array> = {};
	for (const [name, data] of Object.entries(files)) if (name.startsWith("Pictures/")) pictures[name] = data;
	return { page, items, pictures, warnings: [...new Set(warnings)] };
};

const textItem = (
	styles: Styles,
	node: Node,
	box: Box,
	graphic: string | undefined,
	textStyle: string | undefined,
	hDefault: "left" | "center" = "left",
	vDefault: "top" | "middle" = "top",
): OdgItem => {
	const g = [graphic];
	const pad = (side: string) => toMm(styles.resolve(g, `fo:padding-${side}`) ?? styles.resolve(g, "fo:padding") ?? "0");
	const h = styles.resolve(g, "draw:textarea-horizontal-align");
	const v = styles.resolve(g, "draw:textarea-vertical-align");
	return {
		kind: "text",
		...box,
		hAlign: h === "center" ? "center" : h === "right" ? "right" : h === "left" || h === "justify" ? "left" : hDefault,
		vAlign: v === "middle" ? "middle" : v === "bottom" ? "bottom" : v === "top" ? "top" : vDefault,
		wrap: styles.resolve(g, "draw:auto-grow-width") === "false" || styles.resolve(g, "fo:wrap-option") === "wrap",
		paddingMm: [round(pad("top")), round(pad("right")), round(pad("bottom")), round(pad("left"))],
		paragraphs: readParagraphs(styles, node, [textStyle, graphic]),
	};
};
