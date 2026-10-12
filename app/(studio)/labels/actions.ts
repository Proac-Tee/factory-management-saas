"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createFolder, deleteFolder, type FolderResult, moveFolder, moveLabelToFolder, renameFolder } from "@/use-cases/folders";
import { type SaveResult, saveLabel, setArchived } from "@/use-cases/labels";

// Thin wrappers: the use-cases check permission and parse the input. These
// only refresh the pages that show what changed.

export async function saveLabelAction(input: { id: string | null; details: unknown; design: unknown }): Promise<SaveResult> {
	const result = await saveLabel(input);
	if (!result.ok) return result;
	revalidatePath("/labels");
	if (input.id === null) redirect(`/labels/${result.id}?saved=new`);
	revalidatePath(`/labels/${result.id}`);
	return result;
}

export async function archiveLabelAction(id: string, archived: boolean): Promise<{ ok: boolean }> {
	const result = await setArchived({ id, archived });
	if (result.ok) {
		revalidatePath("/labels");
		revalidatePath(`/labels/${id}`);
	}
	return { ok: result.ok };
}

// ─── Folders ─────────────────────────────────────────────────────────────────

const refreshLibrary = (result: FolderResult) => {
	if (result.ok) revalidatePath("/labels");
	return result;
};

export async function createFolderAction(input: { name: string; parentId: string | null }) {
	return refreshLibrary(await createFolder(input));
}

export async function renameFolderAction(input: { id: string; name: string }) {
	return refreshLibrary(await renameFolder(input));
}

export async function moveFolderAction(input: { id: string; parentId: string | null }) {
	return refreshLibrary(await moveFolder(input));
}

export async function deleteFolderAction(id: string) {
	return refreshLibrary(await deleteFolder(id));
}

export async function moveLabelAction(input: { labelId: string; folderId: string | null }) {
	const result = await moveLabelToFolder(input);
	if (result.ok) {
		revalidatePath("/labels");
		revalidatePath(`/labels/${input.labelId}`);
	}
	return result;
}
