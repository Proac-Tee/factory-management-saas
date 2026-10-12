// Labels as PDFs, made in the browser: each label is drawn by the same
// LabelRender the print page uses, captured at 600 dpi and placed on a page
// of the label's true size. A folder becomes a zip with its sub-folders.
// Loaded only when someone downloads (it pulls in the PDF and zip code).

import { zipSync } from "fflate";
import { getFontEmbedCSS, toBlob } from "html-to-image";
import { PDFDocument } from "pdf-lib";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { LabelRender } from "@/components/label-render";
import { BLANK_FIELDS, downloadPaths, PT_PER_MM } from "@/entities/download";
import type { LabelDesign } from "@/entities/label";

export type LabelToDraw = { name: string; design: LabelDesign; barcode: string | null };

const DPI = 600;
/** Screen pixels per mm while drawing; the capture scales this up to DPI. */
const PX_PER_MM = 4;

/** Draws one label off screen and returns it as a PNG at DPI. */
const capture = async (label: LabelToDraw, fontCss: { css?: string }): Promise<Uint8Array> => {
	const host = document.createElement("div");
	host.setAttribute("aria-hidden", "true");
	// Off screen but laid out, so fonts and pictures load as they would on the page.
	host.style.cssText = "position:fixed;left:-100000px;top:0;background:#fff";
	document.body.append(host);
	const root = createRoot(host);
	try {
		flushSync(() =>
			root.render(createElement(LabelRender, { design: label.design, barcode: label.barcode, values: BLANK_FIELDS, scale: PX_PER_MM })),
		);
		const node = host.firstElementChild as HTMLElement;
		await Promise.all([...host.querySelectorAll("img")].map((img) => img.decode().catch(() => undefined)));
		await document.fonts.ready;
		// The fonts are worked out once and reused for every label.
		fontCss.css ??= await getFontEmbedCSS(node);
		const blob = await toBlob(node, {
			pixelRatio: DPI / 25.4 / PX_PER_MM,
			backgroundColor: "#ffffff",
			fontEmbedCSS: fontCss.css,
		});
		if (!blob) throw new Error("The label couldn't be drawn.");
		return new Uint8Array(await blob.arrayBuffer());
	} finally {
		root.unmount();
		host.remove();
	}
};

const toPdf = async (label: LabelToDraw, png: Uint8Array): Promise<Uint8Array> => {
	const pdf = await PDFDocument.create();
	pdf.setTitle(label.name);
	pdf.setCreator("Ember label studio");
	const width = label.design.widthMm * PT_PER_MM;
	const height = label.design.heightMm * PT_PER_MM;
	const page = pdf.addPage([width, height]);
	page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width, height });
	return pdf.save();
};

/** One label as a PDF file. */
export const labelPdf = async (label: LabelToDraw): Promise<Blob> => {
	const bytes = await toPdf(label, await capture(label, {}));
	return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
};

/** Labels as a zip of PDFs in their folders. `onProgress` gets the count done. */
export const labelsZip = async (
	labels: (LabelToDraw & { folderPath: string[] })[],
	onProgress: (done: number) => void,
): Promise<Blob> => {
	const paths = downloadPaths(labels);
	const files: Record<string, Uint8Array> = {};
	const fontCss = {};
	for (const [i, label] of labels.entries()) {
		files[paths[i]] = await toPdf(label, await capture(label, fontCss));
		onProgress(i + 1);
	}
	// PDFs of pictures are compressed already; storing them is faster and as small.
	const zip = zipSync(files, { level: 0 });
	return new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" });
};

/** Hands a file to the browser to save. */
export const saveFile = (blob: Blob, fileName: string) => {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
