"use server";

import { type CheckResult, type FindResult, checkPrintedLabel, findLabels } from "@/use-cases/labels";

// Thin wrappers: the use-cases check permission and parse the input.

export async function findLabelsAction(input: string): Promise<FindResult> {
	return findLabels(input);
}

export async function checkLabelAction(labelId: string, scanned: string): Promise<CheckResult> {
	return checkPrintedLabel({ labelId, scanned });
}
