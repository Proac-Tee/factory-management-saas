import "server-only";
import { z } from "zod";
import { listFolders } from "@/data-access/folders";
import { saveImage, storedImages } from "@/data-access/images";
import { existingSources, type ImportOutcome, saveImportedLabel } from "@/data-access/labels";
import { buildTree, folderOptions, folderPathSchema } from "@/entities/folders";
import { pictureType } from "@/entities/image-size";
import { checkDetails, isPlaced, parseDesign } from "@/entities/label";
import { imagesUsed } from "@/entities/placed";
import { idSchema } from "@/entities/validation";
import { requireMember } from "@/lib/auth";
import { MAX_IMAGE_BYTES } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/label-files";

// Uploading a folder of LibreOffice labels. The browser reads the files and
// sends pictures, then labels in batches; every piece is checked again here,
// since actions are public endpoints.

export const UPLOAD_BATCH = 20;

export type UploadView = { folders: { id: string; label: string }[] };

export const getUploadView = async (): Promise<UploadView> => {
	const member = await requireMember("edit-labels");
	const rows = await listFolders(member.claims);
	return { folders: folderOptions(buildTree(rows)).map(({ id, label }) => ({ id, label })) };
};

const sourceFileSchema = z.string().trim().min(1).max(400);
const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** Which files are in the library already, so the person can skip or replace them. */
export const findExisting = async (input: unknown): Promise<string[]> => {
	const member = await requireMember("edit-labels");
	const files = z.array(sourceFileSchema).max(2000).safeParse(input);
	return files.success ? existingSources(member.claims, files.data) : [];
};

/** Which pictures still need sending. */
export const findMissingImages = async (input: unknown): Promise<string[]> => {
	const member = await requireMember("edit-labels");
	const hashes = z.array(hashSchema).max(2000).safeParse(input);
	if (!hashes.success) return [];
	const stored = await storedImages(member.claims, hashes.data);
	return hashes.data.filter((h) => !stored.has(h));
};

export type ImageResult = { ok: true; hash: string } | { ok: false; message: string };

/** Stores one picture, named by the hash of what arrived (not what was claimed). */
export const uploadImage = async (form: FormData): Promise<ImageResult> => {
	const member = await requireMember("edit-labels");
	const file = form.get("picture");
	if (!(file instanceof Blob)) return { ok: false, message: "No picture arrived." };
	if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
		return { ok: false, message: `A picture is bigger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB, so it's left out.` };
	}
	const bytes = new Uint8Array(await file.arrayBuffer());
	const type = pictureType(bytes);
	if (!type) return { ok: false, message: "A picture isn't a PNG, JPEG, GIF or WebP, so it's left out." };
	const hash = await sha256Hex(bytes);
	await saveImage(member.claims, hash, type, bytes);
	return { ok: true, hash };
};

const uploadLabelSchema = z.object({
	sourceFile: sourceFileSchema,
	folderPath: folderPathSchema,
	details: z.unknown(),
	design: z.unknown(),
});

const batchSchema = z.object({
	parentId: idSchema.nullable(),
	replace: z.boolean(),
	labels: z.array(uploadLabelSchema).min(1).max(UPLOAD_BATCH),
});

export type LabelUploadResult = { sourceFile: string } & ({ ok: true; outcome: ImportOutcome } | { ok: false; message: string });

/** Saves a batch of labels; each succeeds or fails on its own. */
export const uploadLabels = async (input: unknown): Promise<{ ok: true; results: LabelUploadResult[] } | { ok: false; message: string }> => {
	const member = await requireMember("edit-labels");
	const batch = batchSchema.safeParse(input);
	if (!batch.success) return { ok: false, message: "The upload didn't arrive in one piece. Try again." };
	const { parentId, replace, labels } = batch.data;

	const designs = labels.map((l) => parseDesign(l.design));
	const wanted = [...new Set(designs.flatMap((d) => (d.ok && isPlaced(d.design) ? imagesUsed(d.design) : [])))];
	const stored = await storedImages(member.claims, wanted);

	const results: LabelUploadResult[] = [];
	for (const [i, label] of labels.entries()) {
		const { sourceFile } = label;
		const design = designs[i];
		if (!design.ok) {
			results.push({ sourceFile, ok: false, message: `Its layout couldn't be kept: ${design.message}` });
			continue;
		}
		if (isPlaced(design.design) && imagesUsed(design.design).some((h) => !stored.has(h))) {
			results.push({ sourceFile, ok: false, message: "One of its pictures didn't upload. Try again." });
			continue;
		}
		const details = checkDetails(label.details);
		if (!details.ok) {
			results.push({ sourceFile, ok: false, message: details.message });
			continue;
		}
		try {
			const outcome = await saveImportedLabel(member.claims, {
				parentId,
				folderPath: label.folderPath,
				sourceFile,
				details: details.details,
				design: design.design,
				replace,
			});
			results.push({ sourceFile, ok: true, outcome });
		} catch (error) {
			console.error(`Upload of ${sourceFile} failed`, error);
			results.push({ sourceFile, ok: false, message: "It couldn't be saved. Try again." });
		}
	}
	return { ok: true, results };
};
