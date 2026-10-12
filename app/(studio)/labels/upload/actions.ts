"use server";

import { revalidatePath } from "next/cache";
import { findExisting, findMissingImages, uploadImage, uploadLabels } from "@/use-cases/upload";

// Thin wrappers: the use-cases check permission and parse the input.

export async function findExistingAction(sourceFiles: string[]) {
	return findExisting(sourceFiles);
}

export async function findMissingImagesAction(hashes: string[]) {
	return findMissingImages(hashes);
}

export async function uploadImageAction(form: FormData) {
	return uploadImage(form);
}

export async function uploadLabelsAction(input: {
	parentId: string | null;
	replace: boolean;
	labels: { sourceFile: string; folderPath: string[]; details: unknown; design: unknown }[];
}) {
	const result = await uploadLabels(input);
	if (result.ok) revalidatePath("/labels");
	return result;
}
