"use client";

import { useEffect, useState, useTransition } from "react";
import { checkGtin } from "@/entities/gtin";
import { checkFit, type DetailsField, type LabelDesign, type LabelDetailsInput, type LabelPart } from "@/entities/label";
import { addPart, applyPreset, movePart, newPart, removePart, updatePart } from "@/entities/label-edit";
import type { EditorView } from "@/use-cases/labels";
import { saveLabelAction } from "../../actions";
import { useTooWide } from "./use-too-wide";

export type Tab = "parts" | "details";
export type SaveState = { error?: string; field?: DetailsField | "design"; saved?: boolean };

const detailsOf = (label: EditorView["label"]): LabelDetailsInput => ({
	name: label?.name ?? "",
	customer: label?.customer ?? "",
	kind: label?.kind ?? "srp",
	sku: label?.sku ?? "",
	productName: label?.productName ?? "",
	storage: label?.storage ?? "",
	barcode: label?.barcode ?? "",
});

/**
 * Everything the label editor keeps while someone works: the design, the
 * details, which part is open, and saving. The screen components only draw
 * it; the rules come from entities/.
 */
export function useLabelEditor({ label, design: initialDesign, products }: EditorView, justSaved: boolean) {
	const [design, setDesign] = useState<LabelDesign>(initialDesign);
	const [details, setDetails] = useState<LabelDetailsInput>(() => detailsOf(label));
	const [tab, setTab] = useState<Tab>("parts");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [dirty, setDirty] = useState(false);
	const [result, setResult] = useState<SaveState>(justSaved ? { saved: true } : {});
	const [saving, startSaving] = useTransition();

	// Warn before leaving with unsaved changes.
	useEffect(() => {
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	const touched = () => {
		setDirty(true);
		setResult({});
	};
	const changeDesign = (next: LabelDesign) => {
		setDesign(next);
		touched();
	};

	const parts = {
		update: (id: string, patch: Partial<LabelPart>) => changeDesign(updatePart(design, id, patch)),
		move: (id: string, by: -1 | 1) => changeDesign(movePart(design, id, by)),
		remove: (id: string) => {
			changeDesign(removePart(design, id));
			if (selectedId === id) setSelectedId(null);
		},
		add: (kind: LabelPart["kind"]) => {
			const part = newPart(kind, `p${Date.now().toString(36)}`);
			changeDesign(addPart(design, part));
			setSelectedId(part.id);
		},
		toggle: (id: string) => setSelectedId((current) => (current === id ? null : id)),
	};

	const changeDetail = <F extends DetailsField>(field: F, value: LabelDetailsInput[F]) => {
		setDetails((d) => {
			const next = { ...d, [field]: value };
			// Picking a SKU we know brings in its product's name.
			if (field === "sku") {
				const known = products.find((p) => p.sku === String(value).trim().toUpperCase());
				if (known) next.productName = known.name;
			}
			return next;
		});
		touched();
	};

	const save = () =>
		startSaving(async () => {
			const saved = await saveLabelAction({ id: label?.id ?? null, details, design });
			if (saved.ok) {
				setDirty(false);
				setResult({ saved: true });
			} else {
				setResult({ error: saved.message, field: saved.field });
				if (saved.field && saved.field !== "design") setTab("details");
			}
		});

	const gtin = details.barcode.trim() ? checkGtin(details.barcode) : null;
	const sku = details.sku.trim().toUpperCase();

	return {
		design,
		details,
		tab,
		setTab,
		selectedId,
		dirty,
		result,
		saving,
		fit: checkFit(design),
		tooWide: useTooWide(design),
		gtin,
		previewBarcode: gtin?.ok ? gtin.gtin : null,
		/** The product the typed SKU belongs to, if it exists already. */
		product: sku ? (products.find((p) => p.sku === sku) ?? null) : null,
		parts,
		size: {
			change: changeDesign,
			preset: (preset: { widthMm: number; heightMm: number }) => changeDesign(applyPreset(design, preset)),
		},
		changeDetail,
		save,
	};
}

export type LabelEditorState = ReturnType<typeof useLabelEditor>;
