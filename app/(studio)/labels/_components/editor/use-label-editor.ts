"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { checkGtin } from "@/entities/gtin";
import { checkFit, type DetailsField, isPlaced, type LabelDesign, type LabelDetailsInput, type LabelPart, type StackDesign } from "@/entities/label";
import { addPart, applyPreset, movePart, newPart, removePart, updatePart } from "@/entities/label-edit";
import type { PlacedDesign, PlacedPart } from "@/entities/placed";
import { addPlacedPart, newTextPart, nudgePart, removePlacedPart, updatePlacedPart } from "@/entities/placed-edit";
import type { EditorView } from "@/use-cases/labels";
import { saveLabelAction } from "../../actions";
import { useTooWide } from "./use-too-wide";

export type Tab = "parts" | "details";
/** A save problem tied to a field, shown next to it. */
export type FieldError = { field: DetailsField | "design"; message: string } | null;

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
	const [fieldError, setFieldError] = useState<FieldError>(null);
	const [saving, startSaving] = useTransition();
	const toast = useToast();
	const router = useRouter();
	const pathname = usePathname();

	// A new label is saved on the server, which then opens it here with
	// ?saved=new: say so once, and drop the flag so a refresh doesn't repeat it.
	const announced = useRef(false);
	useEffect(() => {
		if (!justSaved || announced.current) return;
		announced.current = true;
		toast.show("Label created");
		router.replace(pathname, { scroll: false });
	}, [justSaved, toast, router, pathname]);

	// Warn before leaving with unsaved changes.
	useEffect(() => {
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	const touched = () => {
		setDirty(true);
		setFieldError(null);
	};
	const changeDesign = (next: LabelDesign) => {
		setDesign(next);
		touched();
	};

	// Stacked labels (made in the app) and placed ones (imported) have their own tools.
	const stack: StackDesign | null = isPlaced(design) ? null : design;
	const placedDesign: PlacedDesign | null = isPlaced(design) ? design : null;
	const newId = () => `p${Date.now().toString(36)}`;

	const parts = {
		update: (id: string, patch: Partial<LabelPart>) => stack && changeDesign(updatePart(stack, id, patch)),
		move: (id: string, by: -1 | 1) => stack && changeDesign(movePart(stack, id, by)),
		remove: (id: string) => {
			if (!stack) return;
			changeDesign(removePart(stack, id));
			if (selectedId === id) setSelectedId(null);
		},
		add: (kind: LabelPart["kind"]) => {
			if (!stack) return;
			const part = newPart(kind, newId());
			changeDesign(addPart(stack, part));
			setSelectedId(part.id);
		},
		toggle: (id: string) => setSelectedId((current) => (current === id ? null : id)),
	};

	const placed = {
		update: (id: string, patch: Partial<PlacedPart>) => placedDesign && changeDesign(updatePlacedPart(placedDesign, id, patch)),
		replace: (part: PlacedPart) => placedDesign && changeDesign(updatePlacedPart(placedDesign, part.id, part)),
		nudge: (id: string, dx: number, dy: number) => placedDesign && changeDesign(nudgePart(placedDesign, id, dx, dy)),
		remove: (id: string) => {
			if (!placedDesign) return;
			changeDesign(removePlacedPart(placedDesign, id));
			if (selectedId === id) setSelectedId(null);
		},
		addText: () => {
			if (!placedDesign) return;
			const part = newTextPart(newId());
			changeDesign(addPlacedPart(placedDesign, part));
			setSelectedId(part.id);
		},
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

	const gtin = details.barcode.trim() ? checkGtin(details.barcode) : null;
	const sku = details.sku.trim().toUpperCase();
	/** The product the typed SKU belongs to, if it exists already. */
	const product = sku ? (products.find((p) => p.sku === sku) ?? null) : null;
	const productName = details.productName.trim().replace(/\s+/g, " ");
	const renamesProduct = product !== null && productName !== "" && productName !== product.name;

	const save = () => {
		if (saving) return;
		startSaving(async () => {
			const saved = await saveLabelAction({ id: label?.id ?? null, details, design });
			if (saved.ok) {
				setDirty(false);
				toast.show(
					renamesProduct
						? `Label saved. Product renamed on ${product.labelCount === 1 ? "its label" : `all ${product.labelCount} labels`}.`
						: "Label saved",
				);
				return;
			}
			if (saved.field) {
				setFieldError({ field: saved.field, message: saved.message });
				if (saved.field !== "design") setTab("details");
				toast.show(saved.field === "design" ? saved.message : "Couldn't save. Check the highlighted field.", { tone: "problem" });
			} else {
				toast.show(saved.message, { tone: "problem" });
			}
		});
	};

	// Ctrl/⌘+S saves, as in every other editor.
	const saveRef = useRef(save);
	useEffect(() => {
		saveRef.current = save;
	});
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				saveRef.current();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return {
		design,
		details,
		tab,
		setTab,
		selectedId,
		dirty,
		fieldError,
		saving,
		stack,
		placedDesign,
		fit: stack ? checkFit(stack) : null,
		tooWide: useTooWide(stack),
		gtin,
		previewBarcode: gtin?.ok ? gtin.gtin : null,
		product,
		renamesProduct,
		parts,
		placed,
		size: {
			change: changeDesign,
			preset: (preset: { widthMm: number; heightMm: number }) => stack && changeDesign(applyPreset(stack, preset)),
		},
		changeDetail,
		save,
	};
}

export type LabelEditorState = ReturnType<typeof useLabelEditor>;
