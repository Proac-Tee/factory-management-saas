"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkDetails, parseDesign } from "@/entities/label";
import { customerFor, fileToSkip } from "@/entities/label-import";
import { type PreparedLabel, prepareLabel } from "@/lib/label-files";
import { findExistingAction, findMissingImagesAction, uploadImageAction, uploadLabelsAction } from "./actions";

// The upload, step by step: read the dropped files here in the browser,
// show them, then send the pictures and the labels in batches.

export type DroppedFile = { path: string; file: File };

export type PreviewLabel = PreparedLabel & {
	/** Its path as dropped, before any outer folder is left out. */
	droppedPath: string;
	/** Already in the library (matched by where it sits in the library). */
	exists: boolean;
	/** Why it can't be uploaded, if it can't. */
	problem: string | null;
};

/** A folder around everything dropped (e.g. "Label Designs"), which can be left out. */
export type OuterFolder = { name: string; leftOut: boolean };

export type Outcome = { added: number; replaced: number; skipped: number; failed: { sourceFile: string; message: string }[] };

export type UploadState =
	| { step: "choose" }
	| { step: "reading"; done: number; total: number }
	| {
			step: "preview";
			labels: PreviewLabel[];
			outer: OuterFolder | null;
			skippedFiles: { path: string; reason: string }[];
			unreadable: { path: string; message: string }[];
	  }
	| { step: "uploading"; phase: "pictures" | "labels"; done: number; total: number }
	| { step: "done"; outcome: Outcome };

/** What the server expects for a label's details: every field as typed. */
const detailsOf = (l: PreparedLabel) => ({
	name: l.name,
	customer: l.customer,
	kind: l.kind,
	sku: l.sku ?? "",
	productName: l.productName ?? "",
	storage: l.storage ?? "",
	barcode: l.barcode ?? "",
});

const BATCH = 20;

/** The one folder every dropped file sits in, if there is one. */
const outerFolderOf = (paths: string[]): string | null => {
	const tops = new Set(paths.map((p) => (p.includes("/") ? p.split("/")[0] : "")));
	const [top] = tops;
	return tops.size === 1 && top ? top : null;
};

/**
 * Where a label goes: its folders under the chosen destination, and its path
 * in the library (`base` is the destination's own path), which identifies
 * the file when it's uploaded again.
 */
const place = (l: PreviewLabel, base: string[], leaveOutOuter: boolean): PreviewLabel => {
	const parts = l.droppedPath.split("/");
	const kept = leaveOutOuter ? parts.slice(1) : parts;
	return { ...l, folderPath: kept.slice(0, -1), sourceFile: [...base, ...kept].join("/") };
};

export function useUpload() {
	const [state, setState] = useState<UploadState>({ step: "choose" });
	const [replace, setReplace] = useState(false);
	// Pictures shown in the preview, as object URLs, by hash.
	const urls = useRef(new Map<string, string>());
	// The destination's path, for placing labels when the outer folder is toggled.
	const base = useRef<string[]>([]);

	const clearUrls = useCallback(() => {
		for (const url of urls.current.values()) URL.revokeObjectURL(url);
		urls.current.clear();
	}, []);
	useEffect(() => clearUrls, [clearUrls]);

	const imageSrc = useCallback((hash: string) => urls.current.get(hash) ?? "", []);

	/** Marks the labels already in the library; if that can't be checked, none are. */
	const markExisting = async (labels: PreviewLabel[]) => {
		const existing = new Set(labels.length ? await findExistingAction(labels.map((l) => l.sourceFile)).catch(() => []) : []);
		return labels.map((l) => ({ ...l, exists: existing.has(l.sourceFile) }));
	};

	/** Reads the files; `destination` is the path of the folder they're going into. */
	const read = async (files: DroppedFile[], destination: string[]) => {
		const skippedFiles: { path: string; reason: string }[] = [];
		const toRead: DroppedFile[] = [];
		for (const f of files) {
			const reason = fileToSkip(f.path);
			if (reason) skippedFiles.push({ path: f.path, reason });
			else toRead.push(f);
		}
		clearUrls();
		base.current = destination;
		setState({ step: "reading", done: 0, total: toRead.length });

		// The reader loads on first use only.
		const { scanPicture } = await import("@/lib/barcode-detector");
		const scanned = new Map<string, Promise<string | null>>();
		const prepared: PreviewLabel[] = [];
		const unreadable: { path: string; message: string }[] = [];
		for (const [i, f] of toRead.entries()) {
			try {
				// The destination's path counts too: a folder dropped into LENHAMS is for Lenhams.
				const fullPath = [...destination, f.path].join("/");
				const label = await prepareLabel(fullPath, new Uint8Array(await f.file.arrayBuffer()), scanPicture, scanned);
				for (const p of label.pictures) {
					if (!urls.current.has(p.hash)) {
						urls.current.set(p.hash, URL.createObjectURL(new Blob([p.bytes as Uint8Array<ArrayBuffer>], { type: p.type })));
					}
				}
				const details = checkDetails(detailsOf(label));
				const design = parseDesign(label.design);
				const problem = !details.ok ? details.message : !design.ok ? `Its layout couldn't be kept: ${design.message}` : null;
				prepared.push({ ...label, droppedPath: f.path, exists: false, problem });
			} catch {
				unreadable.push({ path: f.path, message: "It isn't a LibreOffice Draw file, or it's damaged." });
			}
			setState({ step: "reading", done: i + 1, total: toRead.length });
		}

		// A wrapper folder (dropping "Label Designs" rather than LENHAMS) is
		// left out by default when the customer folders are inside it.
		const outerName = outerFolderOf(prepared.map((l) => l.droppedPath));
		const outer = outerName
			? { name: outerName, leftOut: customerFor(`${outerName}/x.odg`) === "Ember" && prepared.some((l) => l.customer !== "Ember") }
			: null;
		const labels = (await markExisting(prepared.map((l) => place(l, destination, outer?.leftOut ?? false)))).sort((a, b) =>
			a.sourceFile.localeCompare(b.sourceFile, "en-GB", { numeric: true }),
		);
		setState({ step: "preview", labels, outer, skippedFiles, unreadable });
	};

	/** Keeps or leaves out the outer folder. */
	const setOuterLeftOut = async (leftOut: boolean) => {
		if (state.step !== "preview" || !state.outer) return;
		const labels = await markExisting(state.labels.map((l) => place(l, base.current, leftOut)));
		setState({ ...state, labels, outer: { ...state.outer, leftOut } });
	};

	const upload = async (labels: PreviewLabel[], parentId: string | null) => {
		const toSend = labels.filter((l) => !l.problem && (replace || !l.exists));
		const outcome: Outcome = { added: 0, replaced: 0, skipped: labels.filter((l) => l.exists && !replace).length, failed: [] };

		// Pictures first, each once, only those the library doesn't have.
		const pictures = new Map(toSend.flatMap((l) => l.pictures.map((p) => [p.hash, p] as const)));
		const missing = pictures.size ? await findMissingImagesAction([...pictures.keys()]) : [];
		for (const [i, hash] of missing.entries()) {
			setState({ step: "uploading", phase: "pictures", done: i, total: missing.length });
			const p = pictures.get(hash);
			if (!p) continue;
			const form = new FormData();
			form.set("picture", new Blob([p.bytes as Uint8Array<ArrayBuffer>], { type: p.type }));
			// A picture that fails shows up as a failed label below.
			await uploadImageAction(form).catch(() => null);
		}

		for (let i = 0; i < toSend.length; i += BATCH) {
			setState({ step: "uploading", phase: "labels", done: i, total: toSend.length });
			const batch = toSend.slice(i, i + BATCH);
			const result = await uploadLabelsAction({
				parentId,
				replace,
				labels: batch.map((l) => ({ sourceFile: l.sourceFile, folderPath: l.folderPath, details: detailsOf(l), design: l.design })),
			}).catch(() => ({ ok: false as const, message: "The connection dropped. Try again." }));
			if (!result.ok) {
				outcome.failed.push(...batch.map((l) => ({ sourceFile: l.sourceFile, message: result.message })));
				continue;
			}
			for (const r of result.results) {
				if (!r.ok) outcome.failed.push({ sourceFile: r.sourceFile, message: r.message });
				else outcome[r.outcome]++;
			}
		}
		outcome.failed.push(
			...labels.filter((l) => l.problem).map((l) => ({ sourceFile: l.sourceFile, message: l.problem ?? "" })),
		);
		setState({ step: "done", outcome });
	};

	const reset = () => {
		clearUrls();
		setState({ step: "choose" });
	};

	return { state, read, upload, reset, replace, setReplace, setOuterLeftOut, imageSrc };
}

// ─── Reading what was dropped ────────────────────────────────────────────────

const readAll = (reader: FileSystemDirectoryReader) =>
	new Promise<FileSystemEntry[]>((resolve, reject) => {
		const all: FileSystemEntry[] = [];
		// readEntries gives up to 100 at a time; an empty batch is the end.
		const next = () =>
			reader.readEntries((batch) => {
				if (batch.length === 0) resolve(all);
				else {
					all.push(...batch);
					next();
				}
			}, reject);
		next();
	});

const walk = async (entry: FileSystemEntry, out: DroppedFile[]) => {
	if (entry.isFile) {
		const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
		out.push({ path: entry.fullPath.replace(/^\//, ""), file });
	} else if (entry.isDirectory) {
		for (const child of await readAll((entry as FileSystemDirectoryEntry).createReader())) await walk(child, out);
	}
};

/** Every file in what was dropped, folders included, with its path from the dropped folder. */
export const filesFromDrop = async (data: DataTransfer): Promise<DroppedFile[]> => {
	// Entries must be taken before the first await; the list empties after.
	const entries = [...data.items].map((item) => item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => Boolean(e));
	if (entries.length === 0) return [...data.files].map((file) => ({ path: file.name, file }));
	const out: DroppedFile[] = [];
	for (const entry of entries) await walk(entry, out);
	return out;
};

/** Files from a file picker; a folder picker gives each file's path inside it. */
export const filesFromInput = (list: FileList): DroppedFile[] =>
	[...list].map((file) => ({ path: file.webkitRelativePath || file.name, file }));
