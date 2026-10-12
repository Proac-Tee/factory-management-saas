// Reading a LibreOffice label file ready to upload: the label laid out as
// drawn, and the pictures it uses, each named by its SHA-256. Runs in the
// browser (the upload page), so files are read on the person's computer and
// only what's needed is sent. The barcode reader is passed in.

import { pictureType } from "@/entities/image-size";
import { type ImportedLabel, importLabel, type PictureInfo, productNameFor } from "@/entities/label-import";
import { readOdg } from "@/entities/odg";

export type StoredPicture = { hash: string; type: NonNullable<ReturnType<typeof pictureType>>; bytes: Uint8Array };

export type PreparedLabel = ImportedLabel & {
	productName: string | null;
	/** Pictures the label shows, to store before the label. */
	pictures: StoredPicture[];
};

/** Reads the barcode in a picture; null if there's none. */
export type PictureScanner = (picture: StoredPicture) => Promise<string | null>;

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
	const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * One file, from its path in the dropped folder. `scanned` remembers what
 * each picture held, so a logo used on fifty labels is read once.
 */
export const prepareLabel = async (
	path: string,
	bytes: Uint8Array,
	scan: PictureScanner,
	scanned: Map<string, Promise<string | null>> = new Map(),
): Promise<PreparedLabel> => {
	const doc = readOdg(bytes);
	const info: PictureInfo = {};
	const pictures = new Map<string, StoredPicture>();
	const used = new Set(doc.items.flatMap((i) => (i.kind === "image" ? [i.href] : [])));
	for (const href of used) {
		const data = doc.pictures[href];
		const type = data ? pictureType(data) : null;
		if (!data || !type) {
			info[href] = { hash: null, scanned: null };
			continue;
		}
		const picture = { hash: await sha256Hex(data), type, bytes: data };
		pictures.set(picture.hash, picture);
		if (!scanned.has(picture.hash)) scanned.set(picture.hash, scan(picture).catch(() => null));
		info[href] = { hash: picture.hash, scanned: await scanned.get(picture.hash)! };
	}
	const label = importLabel(path, doc, info);
	return {
		...label,
		productName: label.sku ? productNameFor(label.name, label.sku) : null,
		pictures: [...pictures.values()],
	};
};
