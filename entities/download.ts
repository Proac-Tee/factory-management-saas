// Downloading labels as PDFs: one file per label, a folder as a zip with the
// same sub-folders. The rules for names and paths live here, tested.

import { FIELDS, type FieldValues } from "./label";

/** Fields print as a line to write on: a download never carries a made-up batch or date. */
export const BLANK_FIELDS: FieldValues = Object.fromEntries(FIELDS.map((f) => [f.key, "________"]));

export const PT_PER_MM = 72 / 25.4;

/** A name that's safe as a file or folder name on Windows, Mac and Linux. */
export const safeFileName = (name: string, fallback = "Label"): string => {
	const safe = name
		.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, " ")
		.replace(/\s+/g, " ")
		.replace(/^[\s.]+|[\s.]+$/g, "")
		.slice(0, 120)
		.trim();
	return safe || fallback;
};

/**
 * The path of each label's PDF inside the zip, in the order given: its
 * folders, then its name. Two labels with the same name in one folder get
 * "(2)", "(3)"… (compared without regard to capitals, as Windows does).
 */
export const downloadPaths = (labels: { name: string; folderPath: string[] }[]): string[] => {
	const taken = new Set<string>();
	return labels.map(({ name, folderPath }) => {
		const folders = folderPath.map((f) => safeFileName(f, "Folder"));
		const base = safeFileName(name);
		for (let n = 1; ; n++) {
			const path = [...folders, `${base}${n === 1 ? "" : ` (${n})`}.pdf`].join("/");
			if (!taken.has(path.toLowerCase())) {
				taken.add(path.toLowerCase());
				return path;
			}
		}
	});
};
