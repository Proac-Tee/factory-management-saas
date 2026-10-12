import "server-only";
import { createLabel, getLabel, recordCheck, updateLabel } from "@/data-access/labels";
import { checkGtin } from "@/entities/gtin";
import { checkDetails, type LabelDetailsInput, parseDesign } from "@/entities/label";
import { requireMember } from "@/lib/auth";

// The label studio's use cases. Each one checks the person may do it, checks
// the input with the entity rules, then saves through data-access (as the
// person, so the database policies agree).

export type SaveResult =
	| { ok: true; id: string }
	| { ok: false; field?: keyof LabelDetailsInput | "design"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const saveLabel = async (input: {
	id: string | null;
	details: LabelDetailsInput;
	design: unknown;
}): Promise<SaveResult> => {
	const member = await requireMember("edit-labels");
	const details = checkDetails(input.details);
	if (!details.ok) return { ok: false, field: details.field, message: details.message };
	const design = parseDesign(input.design);
	if (!design.ok) return { ok: false, field: "design", message: design.message };

	if (input.id === null) {
		const id = await createLabel(member.claims, details.details, design.design);
		return { ok: true, id };
	}
	if (!UUID.test(input.id)) return { ok: false, message: "That label wasn't found. Go back to the library." };
	const saved = await updateLabel(member.claims, input.id, { details: details.details, design: design.design });
	return saved ? { ok: true, id: input.id } : { ok: false, message: "That label wasn't found. Go back to the library." };
};

export const setArchived = async (id: string, archived: boolean) => {
	const member = await requireMember("edit-labels");
	if (!UUID.test(id)) return false;
	return updateLabel(member.claims, id, { archived });
};

export type CheckResult =
	| { ok: true; result: "pass" | "fail"; expected: string; scanned: string; checkedAt: string; checkedBy: string }
	| { ok: false; message: string };

/** Compares a scanned printed label with the barcode the label should carry. */
export const checkPrintedLabel = async (labelId: string, scannedInput: string): Promise<CheckResult> => {
	const member = await requireMember("use-labels");
	if (!UUID.test(labelId)) return { ok: false, message: "Pick the label you printed first." };
	const label = await getLabel(member.claims, labelId);
	if (!label) return { ok: false, message: "That label wasn't found." };
	if (!label.barcode) return { ok: false, message: "This label has no barcode number yet, so there's nothing to check against." };

	const scanned = scannedInput.replace(/\s+/g, "");
	if (!/^\d{8,14}$/.test(scanned)) return { ok: false, message: "That wasn't a product barcode. Scan the long barcode on the label." };
	const valid = checkGtin(scanned);
	// A misread or wrong barcode is still recorded as a failed check.
	const saved = await recordCheck(member.claims, labelId, label.barcode, valid.ok ? valid.gtin : scanned);
	return {
		ok: true,
		result: saved.result,
		expected: label.barcode,
		scanned,
		checkedAt: saved.checkedAt,
		checkedBy: member.name,
	};
};
