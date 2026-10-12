"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
