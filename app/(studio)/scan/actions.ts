"use server";

import { findByBarcode } from "@/data-access/labels";
import { BARCODE_KIND_NAMES, checkGtin } from "@/entities/gtin";
import { KIND_NAMES } from "@/entities/label";
import { requireMember } from "@/lib/auth";
import { type CheckResult, checkPrintedLabel } from "@/use-cases/labels";

export type FoundLabel = { id: string; name: string; detail: string; exact: boolean };
export type FindResult =
	| { ok: true; gtin: string; kindName: string; labels: FoundLabel[] }
	| { ok: false; message: string };

/** Labels carrying a scanned or typed barcode, exact matches first. */
export async function findLabelsAction(input: string): Promise<FindResult> {
	const member = await requireMember("use-labels");
	const gtin = checkGtin(input);
	if (!gtin.ok) return { ok: false, message: gtin.message };
	const labels = await findByBarcode(member.claims, gtin.gtin);
	return {
		ok: true,
		gtin: gtin.gtin,
		kindName: BARCODE_KIND_NAMES[gtin.kind],
		labels: labels.map((l) => ({
			id: l.id,
			name: l.name,
			detail: `${l.customer}, ${KIND_NAMES[l.kind]}${l.barcode === gtin.gtin ? "" : `, ${l.barcode?.length === 14 ? "case" : "pouch"} barcode`}`,
			exact: l.barcode === gtin.gtin,
		})),
	};
}

export async function checkLabelAction(labelId: string, scanned: string): Promise<CheckResult> {
	return checkPrintedLabel(labelId, scanned);
}
