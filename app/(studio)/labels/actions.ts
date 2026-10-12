"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LabelDetailsInput } from "@/entities/label";
import { type SaveResult, saveLabel, setArchived } from "@/use-cases/labels";

export async function saveLabelAction(input: {
	id: string | null;
	details: LabelDetailsInput;
	design: unknown;
}): Promise<SaveResult> {
	const result = await saveLabel(input);
	if (!result.ok) return result;
	revalidatePath("/labels");
	if (input.id === null) redirect(`/labels/${result.id}?saved=new`);
	revalidatePath(`/labels/${result.id}`);
	return result;
}

export async function archiveLabelAction(id: string, archived: boolean): Promise<{ ok: boolean }> {
	const ok = await setArchived(id, archived);
	if (ok) {
		revalidatePath("/labels");
		revalidatePath(`/labels/${id}`);
	}
	return { ok };
}
